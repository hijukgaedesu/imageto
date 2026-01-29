
export interface Book {
  itemId: string;
  title: string;
  author: string;
  link: string;
  cover: string;
  description?: string;
}

export interface ImageResult {
  title: string;
  url: string;
  source?: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  properties: any;
}

export interface AppConfig {
  notionToken: string;
  notionDatabaseId: string;
  aladdinTtbKey: string;
}
