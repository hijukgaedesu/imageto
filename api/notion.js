
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Notion-Version, x-target-url'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const targetUrl = req.headers['x-target-url'] || 'https://api.notion.com/v1/search';
  const notionToken = req.headers['authorization'];
  const notionVersion = req.headers['notion-version'] || '2022-06-28';

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': notionToken,
        'Notion-Version': notionVersion,
        'Content-Type': 'application/json',
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      // Vercel은 req.body를 자동으로 파싱하므로 다시 문자열로 바꿔서 보냅니다.
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ message: '노션 API 중계 중 서버 오류가 발생했습니다.', error: error.message });
  }
}
