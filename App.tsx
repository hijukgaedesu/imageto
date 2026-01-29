
import React, { useState, useEffect, useMemo } from 'react';
import { Book, NotionDatabase, AppConfig } from './types';
import { searchBooks } from './services/aladdinService';
import { fetchDatabases, addBookToNotion } from './services/notionService';

type Step = 'config' | 'search';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('config');
  const [config, setConfig] = useState<AppConfig>({
    notionToken: localStorage.getItem('notion_token') || '',
    notionDatabaseId: localStorage.getItem('notion_db_id') || '',
    aladdinTtbKey: localStorage.getItem('aladdin_ttb_key') || ''
  });

  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDbs, setFetchingDbs] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string, tip?: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // 1. URL 파라미터에서 설정값 읽기 (자동 로그인)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = params.get('n'); // Notion Token (encoded)
    const d = params.get('d'); // Database ID
    const a = params.get('a'); // Aladdin Key (encoded)

    if (n && d && a) {
      try {
        const decodedToken = atob(n);
        const decodedAladdin = atob(a);
        
        const newConfig = {
          notionToken: decodedToken,
          notionDatabaseId: d,
          aladdinTtbKey: decodedAladdin
        };
        
        setConfig(newConfig);
        // 설정이 로드되면 자동으로 DB 정보를 가져와서 검색창으로 이동 시도
        autoInitialize(newConfig);
      } catch (e) {
        console.error("Failed to decode URL params");
      }
    }
  }, []);

  const autoInitialize = async (conf: AppConfig) => {
    setFetchingDbs(true);
    try {
      const dbs = await fetchDatabases(conf.notionToken);
      setDatabases(dbs);
      setStep('search');
    } catch (err) {
      setStatus({ type: 'error', msg: '자동 연결에 실패했습니다. 키를 확인해 주세요.' });
    } finally {
      setFetchingDbs(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('notion_token', config.notionToken);
    localStorage.setItem('notion_db_id', config.notionDatabaseId);
    localStorage.setItem('aladdin_ttb_key', config.aladdinTtbKey);
  }, [config]);

  const propertyStatus = useMemo(() => {
    const selectedDb = databases.find(db => db.id === config.notionDatabaseId);
    if (!selectedDb) return null;

    const props = selectedDb.properties;
    const map: any = { title: '', author: '', link: '' };
    const typeErrors: string[] = [];
    const missing: string[] = [];
    
    const titleKey = Object.keys(props).find(key => props[key].type === 'title');
    if (titleKey) map.title = titleKey;
    else missing.push('제목(기본)');

    if (props['작가']) {
      if (props['작가'].type === 'rich_text') map.author = '작가';
      else typeErrors.push(`'작가' 컬럼을 '텍스트' 타입으로 변경해 주세요.`);
    } else missing.push('작가');

    if (props['링크']) {
      if (props['링크'].type === 'url') map.link = '링크';
      else typeErrors.push(`'링크' 컬럼을 'URL' 타입으로 변경해 주세요.`);
    } else missing.push('링크');

    return { map, missing, typeErrors };
  }, [config.notionDatabaseId, databases]);

  const handleFetchDatabases = async () => {
    if (!config.notionToken) {
      setStatus({ type: 'error', msg: '노션 API 토큰을 입력해 주세요.' });
      return;
    }
    setFetchingDbs(true);
    setStatus(null);
    try {
      const dbs = await fetchDatabases(config.notionToken);
      setDatabases(dbs);
      setStatus({ type: 'success', msg: `${dbs.length}개의 DB를 찾았습니다.` });
    } catch (err: any) {
      setStatus({ type: 'error', msg: '연결 실패. 설정을 확인하세요.' });
    } finally {
      setFetchingDbs(false);
    }
  };

  const generateShareUrl = () => {
    if (!config.notionToken || !config.notionDatabaseId || !config.aladdinTtbKey) {
      setStatus({ type: 'error', msg: '모든 설정을 완료한 후 링크를 생성할 수 있습니다.' });
      return;
    }
    const baseUrl = window.location.origin + window.location.pathname;
    const n = btoa(config.notionToken);
    const a = btoa(config.aladdinTtbKey);
    const d = config.notionDatabaseId;
    const finalUrl = `${baseUrl}?n=${n}&a=${a}&d=${d}`;
    setShareUrl(finalUrl);
    navigator.clipboard.writeText(finalUrl);
    setStatus({ type: 'success', msg: '전용 링크가 복사되었습니다! 노션에 붙여넣으세요. ♡' });
  };

  const handleStartSearching = () => {
    if (!config.notionDatabaseId) {
      setStatus({ type: 'error', msg: 'DB를 먼저 선택해 주세요.' });
      return;
    }
    if ((propertyStatus?.missing?.length || 0) > 0 || (propertyStatus?.typeErrors?.length || 0) > 0) {
      setStatus({ type: 'error', msg: '노션 설정을 완료해 주세요.' });
      return;
    }
    setStep('search');
    setStatus(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    setStatus(null);
    try {
      const books = await searchBooks(query, config.aladdinTtbKey);
      setResults(books);
    } catch (err: any) {
      setStatus({ type: 'error', msg: '검색 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToNotion = async (book: Book) => {
    setAddingId(book.itemId);
    setStatus(null);
    try {
      await addBookToNotion(book, config.notionToken, config.notionDatabaseId, propertyStatus?.map);
      setStatus({ 
        type: 'success', 
        msg: `[${book.title}] 등록 성공!`, 
        tip: "갤러리 뷰 '카드 미리보기'를 '페이지 커버'로 설정해 보세요! ♡" 
      });
    } catch (err: any) {
      setStatus({ type: 'error', msg: `등록 실패: ${err.message}` });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#fcfcfc]">
      <div className="w-full max-w-[480px] pink-window flex flex-col h-[680px] shadow-2xl relative overflow-hidden">
        {fetchingDbs && (
           <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-[#FFDDE5] border-t-[#D67C8C] rounded-full animate-spin mb-4"></div>
              <p className="text-xs text-[#D67C8C] font-bold">서재 정보를 가져오는 중...</p>
           </div>
        )}

        <div className="pink-header flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#D67C8C] font-bold">
            <i className={`fas ${step === 'config' ? 'fa-cog' : 'fa-search'}`}></i>
            <span className="text-sm font-sans uppercase tracking-wider">{step === 'config' ? 'Config' : 'Search'}</span>
          </div>
          {step === 'search' && (
            <button onClick={() => setStep('config')} className="text-[10px] px-3 py-1 bg-white border border-[#FFDDE5] rounded-full text-[#D67C8C] hover:bg-[#FFF0F3] transition-all">Setting</button>
          )}
        </div>

        <div className="p-6 flex flex-col flex-1 overflow-hidden">
          {step === 'config' ? (
            <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-[#D67C8C] mb-1">Book Archiver</h1>
                <p className="text-xs text-gray-400">나만의 소중한 서재를 만들어보세요 ♡</p>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#D67C8C] ml-1 uppercase">Notion Token</label>
                  <input type="password" value={config.notionToken} onChange={(e) => setConfig({...config, notionToken: e.target.value})} placeholder="secret_..." className="w-full p-3 text-xs pink-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#D67C8C] ml-1 uppercase">Aladdin Key</label>
                  <input type="text" value={config.aladdinTtbKey} onChange={(e) => setConfig({...config, aladdinTtbKey: e.target.value})} placeholder="TTB Key" className="w-full p-3 text-xs pink-input" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#D67C8C] ml-1 uppercase">Select Database</label>
                  <div className="flex gap-2">
                    <select value={config.notionDatabaseId} onChange={(e) => setConfig({...config, notionDatabaseId: e.target.value})} className="flex-1 p-3 text-xs pink-input bg-white appearance-none cursor-pointer">
                      <option value="">DB를 선택하세요</option>
                      {databases.map(db => <option key={db.id} value={db.id}>{db.title}</option>)}
                    </select>
                    <button onClick={handleFetchDatabases} disabled={fetchingDbs} className="px-4 bg-white border border-[#FFC1CC] text-[#D67C8C] rounded-lg text-xs font-bold hover:bg-[#FFF0F3]">{fetchingDbs ? <i className="fas fa-spinner fa-spin"></i> : '연결'}</button>
                  </div>
                </div>

                {propertyStatus && ((propertyStatus.missing?.length || 0) > 0 || (propertyStatus.typeErrors?.length || 0) > 0) && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100 animate-in zoom-in-95">
                    <p className="text-[11px] font-bold text-red-600 mb-2">⚠️ 노션 설정을 확인해 주세요:</p>
                    <ul className="text-[10px] text-red-500 space-y-2">
                      {propertyStatus.missing.map(m => <li key={m}>• <b>[{m}]</b> 컬럼이 없습니다.</li>)}
                      {propertyStatus.typeErrors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}
                
                {propertyStatus && (propertyStatus.missing?.length || 0) === 0 && (propertyStatus.typeErrors?.length || 0) === 0 && (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2 animate-in zoom-in-95">
                    <i className="fas fa-check-circle text-green-500"></i>
                    <p className="text-[11px] font-bold text-green-700">모든 준비가 완료되었습니다! ♡</p>
                  </div>
                )}
              </div>

              {status && (
                <div className={`mt-4 p-3 rounded-lg text-[11px] flex items-center gap-2 animate-in fade-in ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  <i className={`fas ${status.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                  {status.msg}
                </div>
              )}

              <div className="flex flex-col gap-2 mt-4">
                <button onClick={handleStartSearching} className="w-full py-4 bg-[#D67C8C] text-white rounded-xl font-bold hover:bg-[#c56b7b] transition-all shadow-lg active:scale-95">시작하기</button>
                <button onClick={generateShareUrl} className="w-full py-3 bg-white text-[#D67C8C] border border-[#FFDDE5] rounded-xl text-xs font-bold hover:bg-[#FFF0F3] transition-all">
                  <i className="fas fa-link mr-2"></i>노션 전용 위젯 링크 생성
                </button>
              </div>
              {shareUrl && (
                <p className="mt-2 text-[9px] text-center text-gray-400 break-all leading-tight">생성된 링크를 복사하여 노션 임베드에 사용하세요.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
              <form onSubmit={handleSearch} className="flex gap-3 items-center shrink-0">
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색어를 입력하세요..." className="flex-1 p-3 pink-input text-sm shadow-inner" autoFocus />
                <button type="submit" disabled={loading} className="pink-button-square active:scale-90 shadow-sm">{loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}</button>
              </form>
              <div className="dotted-line shrink-0"></div>

              {status && (
                <div className={`mb-4 p-4 rounded-xl text-[11px] flex flex-col gap-1 animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-info-circle"></i>
                    <span className="font-bold">{status.msg}</span>
                    <button onClick={() => setStatus(null)} className="ml-auto opacity-40 hover:opacity-100"><i className="fas fa-times"></i></button>
                  </div>
                  {status.tip && <p className="mt-1 text-[10px] opacity-80 leading-relaxed">{status.tip}</p>}
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {results.length > 0 ? (
                  <div className="grid gap-4 pb-4">
                    {results.map((book) => (
                      <div key={book.itemId} className="flex gap-4 p-3 bg-white border border-[#f5f5f5] rounded-2xl hover:border-[#FFDDE5] hover:shadow-md transition-all group">
                        <div className="relative shrink-0">
                          <img src={book.cover} alt={book.title} className="w-20 h-28 object-cover rounded-lg shadow-sm group-hover:scale-105 transition-transform" />
                        </div>
                        <div className="flex flex-col justify-between flex-1 min-w-0 py-1">
                          <div>
                            <h3 className="font-bold text-[#37352f] text-xs line-clamp-2 leading-tight group-hover:text-[#D67C8C] transition-colors">{book.title}</h3>
                            <p className="text-[10px] text-gray-400 mt-1 truncate">{book.author}</p>
                          </div>
                          <button onClick={() => handleAddToNotion(book)} disabled={addingId === book.itemId} className="w-full py-2 bg-[#FFF0F3] text-[#D67C8C] border border-[#FFDDE5] rounded-xl text-[10px] font-bold hover:bg-[#D67C8C] hover:text-white transition-all disabled:opacity-50">
                            {addingId === book.itemId ? <i className="fas fa-spinner fa-spin"></i> : '저장하기'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#e2e2e2] py-20"><i className="fas fa-magic text-5xl mb-4 opacity-20"></i><p className="text-sm font-medium">검색 결과가 여기에 나타나요!</p></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
