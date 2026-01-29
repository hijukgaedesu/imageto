
import { Book } from '../types';

const PROXY_BASE = 'https://corsproxy.io/?';

// 알라딘 API를 사용하여 도서 정보를 검색합니다.
export const searchBooks = async (query: string, ttbKey: string): Promise<Book[]> => {
  const url = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ttbKey}&Query=${encodeURIComponent(query)}&QueryType=Keyword&MaxResults=10&start=1&SearchTarget=Book&output=js&Version=20131101`;
  
  try {
    const response = await fetch(`${PROXY_BASE}${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error('알라딘 API 호출 실패');
    
    const data = await response.json();
    return (data.item || []).map((item: any) => ({
      itemId: String(item.itemId || item.isbn13),
      title: item.title,
      author: item.author,
      link: item.link,
      cover: item.cover,
      description: item.description
    }));
  } catch (error) {
    console.error('Aladdin search error:', error);
    throw error;
  }
};
