
/**
 * 노션 API를 직접 호출하면 CORS 에러가 나므로, 
 * Vercel의 서버리스 함수(/api/notion)를 통해 중계합니다.
 */
const NOTION_PROXY = '/api/notion';

const getHeaders = (token, targetUrl) => {
  let cleanToken = (token || '').trim();
  if (cleanToken.startsWith('Bearer ')) {
    cleanToken = cleanToken.replace('Bearer ', '');
  }

  return {
    'Authorization': `Bearer ${cleanToken}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
    'x-target-url': targetUrl
  };
};

export const fetchDatabases = async (token) => {
  const targetUrl = 'https://api.notion.com/v1/search';
  
  try {
    const response = await fetch(NOTION_PROXY, {
      method: 'POST',
      headers: getHeaders(token, targetUrl),
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        page_size: 100
      })
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('노션 API 토큰이 유효하지 않습니다.');
      }
      throw new Error(data.message || `노션 에러 (${response.status})`);
    }

    return (data.results || [])
      .filter(item => item.object === 'database')
      .map(db => ({
        id: db.id,
        title: db.title[0]?.plain_text || '이름 없음',
        properties: db.properties
      }));
  } catch (error) {
    console.error('fetchDatabases error:', error);
    throw error;
  }
};

export const addBookToNotion = async (item, token, databaseId, propertyMap) => {
  const targetUrl = 'https://api.notion.com/v1/pages';
  
  const properties = {};
  
  // 1. 제목 설정 (필수)
  if (propertyMap.title) {
    properties[propertyMap.title] = { 
      title: [{ text: { content: item.title } }] 
    };
  }
  
  // 2. 작가 설정 (텍스트 타입 속성이 매핑된 경우에만)
  if (propertyMap.author && item.author) {
    properties[propertyMap.author] = { 
      rich_text: [{ text: { content: item.author } }] 
    };
  }

  const body = {
    parent: { database_id: databaseId },
    icon: { type: 'external', external: { url: item.cover } },
    cover: { type: 'external', external: { url: item.cover } },
    properties: properties,
    children: [
      { 
        object: 'block', 
        type: 'image', 
        image: { type: 'external', external: { url: item.cover } } 
      },
      { 
        object: 'block', 
        type: 'paragraph', 
        paragraph: { 
          rich_text: [{ text: { content: item.description || '이미지 아카이브입니다.' } }] 
        } 
      }
    ]
  };

  try {
    const response = await fetch(NOTION_PROXY, {
      method: 'POST',
      headers: getHeaders(token, targetUrl),
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `페이지 생성 실패 (${response.status})`);
    }
    
    return data;
  } catch (error) {
    console.error('addBookToNotion error:', error);
    throw error;
  }
};
