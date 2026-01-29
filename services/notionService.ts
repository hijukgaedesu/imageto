
import { NotionDatabase, Book } from '../types';

const PROXY_BASE = 'https://corsproxy.io/?';

export const fetchDatabases = async (token: string): Promise<NotionDatabase[]> => {
  const apiUrl = 'https://api.notion.com/v1/search';
  
  try {
    const response = await fetch(`${PROXY_BASE}${encodeURIComponent(apiUrl)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        page_size: 100
      })
    });

    if (!response.ok) throw new Error(`노션 연결 실패: ${response.status}`);
    const data = await response.json();
    
    return (data.results || [])
      .filter((db: any) => db.object === 'database')
      .map((db: any) => ({
        id: db.id,
        title: db.title[0]?.plain_text || '이름 없는 데이터베이스',
        properties: db.properties
      }));
  } catch (error) {
    console.error('Notion fetch error:', error);
    throw error;
  }
};

export const addBookToNotion = async (book: Book, token: string, databaseId: string, propertyMap: any) => {
  const apiUrl = 'https://api.notion.com/v1/pages';
  
  const properties: any = {};
  
  // 1. 제목 (필수 기본 속성)
  if (propertyMap.title) {
    properties[propertyMap.title] = { title: [{ text: { content: book.title } }] };
  }
  
  // 2. 작가 (텍스트 타입)
  if (propertyMap.author) {
    properties[propertyMap.author] = { rich_text: [{ text: { content: book.author } }] };
  }
  
  // 3. 링크 (URL 타입)
  if (propertyMap.link) {
    properties[propertyMap.link] = { url: book.link };
  }

  const body = {
    parent: { database_id: databaseId },
    icon: { type: 'external', external: { url: book.cover } },
    cover: { type: 'external', external: { url: book.cover } }, // 갤러리 썸네일용 (페이지 커버)
    properties: properties,
    children: [
      {
        object: 'block',
        type: 'image',
        image: {
          type: 'external',
          external: { url: book.cover }
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: book.description || '책 설명이 없습니다.' } }]
        }
      }
    ]
  };

  try {
    const response = await fetch(`${PROXY_BASE}${encodeURIComponent(apiUrl)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '노션 API 오류가 발생했습니다.');
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
};
