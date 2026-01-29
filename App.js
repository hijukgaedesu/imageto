
import React, { useState, useEffect, useMemo } from 'react';
import htm from 'htm';
import { searchImages } from './services/googleImageService.js';
import { fetchDatabases, addBookToNotion } from './services/notionService.js';

const html = htm.bind(React.createElement);

const App = () => {
  const [step, setStep] = useState('config'); // 'config', 'search'
  const [searchView, setSearchView] = useState('results'); // 'results', 'detail'
  
  const [config, setConfig] = useState({
    notionToken: localStorage.getItem('notion_token') || '',
    notionDatabaseId: localStorage.getItem('notion_db_id') || '',
  });

  const [databases, setDatabases] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [groundingMetadata, setGroundingMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingDbs, setFetchingDbs] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [status, setStatus] = useState(null);

  const [selectedImage, setSelectedImage] = useState(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = params.get('n');
    const d = params.get('d');

    if (n && d) {
      try {
        const decodedToken = atob(n);
        const newConfig = { notionToken: decodedToken, notionDatabaseId: d };
        setConfig(newConfig);
        autoInitialize(newConfig);
      } catch (e) { console.error("URL 파라미터 해독 실패"); }
    }
  }, []);

  const autoInitialize = async (conf) => {
    if (!conf.notionToken) return;
    setFetchingDbs(true);
    try {
      const dbs = await fetchDatabases(conf.notionToken);
      setDatabases(dbs);
      setStep('search');
    } catch (err) {
      setStatus({ type: 'error', msg: '연결 실패: ' + err.message });
    } finally { setFetchingDbs(false); }
  };

  useEffect(() => {
    localStorage.setItem('notion_token', config.notionToken);
    localStorage.setItem('notion_db_id', config.notionDatabaseId);
  }, [config]);

  const propertyStatus = useMemo(() => {
    const selectedDb = databases.find(db => db.id === config.notionDatabaseId);
    if (!selectedDb) return null;
    const props = selectedDb.properties;
    const map = { title: '', author: '' };
    
    const titleKey = Object.keys(props).find(key => props[key].type === 'title');
    if (titleKey) map.title = titleKey;
    
    const authorKey = Object.keys(props).find(key => 
      (key === '작가' || key.toLowerCase() === 'author') && props[key].type === 'rich_text'
    );
    if (authorKey) map.author = authorKey;

    return { map, hasAuthor: !!authorKey };
  }, [config.notionDatabaseId, databases]);

  const handleFetchDatabases = async () => {
    if (!config.notionToken) { setStatus({ type: 'error', msg: '토큰을 입력하세요.' }); return; }
    setFetchingDbs(true); setStatus(null);
    try {
      const dbs = await fetchDatabases(config.notionToken);
      setDatabases(dbs);
      setStatus({ type: 'success', msg: `${dbs.length}개의 DB 발견!` });
    } catch (err) { 
      setStatus({ type: 'error', msg: '오류: ' + err.message }); 
    }
    finally { setFetchingDbs(false); }
  };

  const generateShareUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const n = btoa(config.notionToken.trim());
    const d = config.notionDatabaseId;
    const finalUrl = `${baseUrl}?n=${n}&d=${d}`;
    navigator.clipboard.writeText(finalUrl);
    setStatus({ type: 'success', msg: '공유 링크 복사 완료!' });
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query) return;
    setLoading(true); setStatus(null);
    try {
      const searchResult = await searchImages(query);
      setResults(searchResult.images);
      setGroundingMetadata(searchResult.groundingMetadata);
      if (searchResult.images.length === 0) {
        setStatus({ type: 'error', msg: '이미지 검색 결과가 없습니다.' });
      }
    } catch (err) { setStatus({ type: 'error', msg: '검색 실패: ' + err.message }); }
    finally { setLoading(false); }
  };

  const selectImageForDetail = (img) => {
    setSelectedImage(img);
    setManualTitle(img.title || query); 
    setManualAuthor('');
    setSearchView('detail');
    setStatus(null);
  };

  const handleFinalSubmit = async () => {
    if (!manualTitle) {
      setStatus({ type: 'error', msg: '제목을 입력해 주세요.' });
      return;
    }
    setAddingId(selectedImage.url);
    setStatus(null);
    try {
      const payload = {
        title: manualTitle,
        author: manualAuthor,
        cover: selectedImage.url,
        description: `Source: ${selectedImage.source || 'Search Engine'}`
      };
      await addBookToNotion(payload, config.notionToken, config.notionDatabaseId, propertyStatus?.map);
      setStatus({ type: 'success', msg: `저장 완료!`, tip: "노션에서 확인해 보세요." });
      setSearchView('results');
    } catch (err) { 
      setStatus({ type: 'error', msg: '등록 실패: ' + err.message }); 
    }
    finally { setAddingId(null); }
  };

  return html`
    <div className="min-h-screen flex items-center justify-center p-2 bg-slate-50">
      <div className="w-full max-w-[420px] blue-window flex flex-col h-[540px] shadow-xl relative overflow-hidden">
        ${fetchingDbs && html`
          <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#BEE3F8] border-t-[#3182CE] rounded-full animate-spin mb-2"></div>
            <p className="text-[10px] text-[#3182CE] font-bold tracking-widest uppercase">Fetching...</p>
          </div>
        `}
        
        <div className="blue-header flex justify-between items-center py-3 px-5">
          <div className="flex items-center gap-2 text-[#3182CE] font-bold">
            <i className="fas ${step === 'config' ? 'fa-gear' : (searchView === 'detail' ? 'fa-edit' : 'fa-image')} text-xs"></i>
            <span className="text-[11px] uppercase tracking-wider">
              ${step === 'config' ? 'Settings' : (searchView === 'detail' ? 'Entry' : 'Search')}
            </span>
          </div>
          ${step === 'search' && html`
            <div className="flex gap-1.5">
              ${searchView === 'detail' && html`
                <button onClick=${() => setSearchView('results')} className="text-[9px] px-2.5 py-1 bg-white border border-[#BEE3F8] rounded-full text-[#3182CE] font-bold hover:bg-blue-50 transition-all">Back</button>
              `}
              <button onClick=${() => {setStep('config'); setSearchView('results');}} className="text-[9px] px-2.5 py-1 bg-white border border-[#BEE3F8] rounded-full text-[#3182CE] font-bold hover:bg-blue-50 transition-all">Config</button>
            </div>
          `}
        </div>
        
        <div className="p-4 flex flex-col flex-1 overflow-hidden">
          ${step === 'config' ? html`
            <div className="flex flex-col h-full animate-fade-in">
              <div className="mb-4">
                <h1 className="text-xl font-black text-[#3182CE] mb-0.5 tracking-tight">Image Archiver</h1>
                <p className="text-[10px] text-slate-400 font-medium">노션 DB에 이미지를 즉시 수집하세요.</p>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#3182CE] ml-0.5 uppercase">API Token</label>
                  <input type="password" value=${config.notionToken} onChange=${e => setConfig({...config, notionToken: e.target.value})} placeholder="secret_..." className="w-full p-3 text-xs blue-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#3182CE] ml-0.5 uppercase">Select Database</label>
                  <div className="flex gap-1.5">
                    <select value=${config.notionDatabaseId} onChange=${e => setConfig({...config, notionDatabaseId: e.target.value})} className="flex-1 p-3 text-xs blue-input bg-[#f8fafc] appearance-none cursor-pointer">
                      <option value="">데이터베이스 선택</option>
                      ${databases.map(db => html`<option key=${db.id} value=${db.id}>${db.title}</option>`)}
                    </select>
                    <button onClick=${handleFetchDatabases} className="px-3 bg-white border border-[#90CDF4] text-[#3182CE] rounded-xl text-[11px] font-bold active:scale-95 hover:bg-blue-50 transition-all">연결</button>
                  </div>
                </div>
                ${status && html`
                  <div className="p-3 rounded-xl border ${status.type === 'success' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-700'} animate-fade-in">
                    <p className="text-[10px] font-bold">${status.msg}</p>
                  </div>
                `}
              </div>
              
              <div className="flex flex-col gap-2 mt-4 shrink-0">
                <button onClick=${() => setStep('search')} className="w-full py-3 bg-[#3182CE] text-white rounded-xl font-bold text-xs hover:bg-[#2B6CB0] active:scale-95 transition-all shadow-md">검색 시작하기</button>
                <button onClick=${generateShareUrl} className="w-full py-2 bg-white text-[#3182CE] border border-[#BEE3F8] rounded-xl text-[9px] font-bold hover:bg-[#EBF8FF] transition-all">공유 링크 복사</button>
              </div>
            </div>
          ` : (searchView === 'results' ? html`
            <div className="flex flex-col h-full animate-fade-in">
              <form onSubmit=${handleSearch} className="flex gap-2 items-center shrink-0">
                <input 
                  type="text" 
                  value=${query} 
                  onChange=${e => setQuery(e.target.value)} 
                  placeholder="이미지를 검색하세요" 
                  className="flex-1 p-3 blue-input text-xs shadow-inner" 
                />
                <button type="submit" className="blue-button-square !w-10 !h-10 !rounded-xl shadow-sm">
                  ${loading ? html`<i className="fas fa-spinner fa-spin text-xs"></i>` : html`<i className="fas fa-search text-xs"></i>`}
                </button>
              </form>
              <div className="dotted-line !my-3 shrink-0"></div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                ${results.length > 0 ? html`
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    ${results.map(img => html`
                      <div key=${img.url} onClick=${() => selectImageForDetail(img)} className="image-card flex flex-col bg-white border border-slate-100 rounded-xl overflow-hidden cursor-pointer group shadow-sm animate-fade-in">
                        <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                          <img src=${img.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        </div>
                        <div className="p-2">
                          <h3 className="font-bold text-[9px] line-clamp-1 text-slate-500 group-hover:text-[#3182CE] transition-colors">${img.title}</h3>
                        </div>
                      </div>
                    `)}
                  </div>
                ` : html`
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-6 opacity-60">
                    <i className="fas fa-image text-2xl mb-2 opacity-20"></i>
                    <p className="text-[10px] font-semibold text-slate-400">이미지를 검색해 보세요.</p>
                  </div>
                `}
              </div>
            </div>
          ` : html`
            <div className="flex flex-col h-full animate-fade-in">
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                <div className="relative aspect-video rounded-xl overflow-hidden shadow-md border-2 border-white mx-auto max-w-[240px]">
                  <img src=${selectedImage.url} className="w-full h-full object-cover" />
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#3182CE] ml-0.5 uppercase tracking-tighter">제목 (Title)</label>
                    <input 
                      type="text" 
                      value=${manualTitle} 
                      onChange=${e => setManualTitle(e.target.value)} 
                      placeholder="제목 입력" 
                      className="w-full p-2.5 text-xs blue-input" 
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#3182CE] ml-0.5 uppercase tracking-tighter">작가 (Author)</label>
                    <input 
                      type="text" 
                      value=${manualAuthor} 
                      onChange=${e => setManualAuthor(e.target.value)} 
                      placeholder="작가 또는 설명 입력" 
                      className="w-full p-2.5 text-xs blue-input" 
                    />
                  </div>
                </div>

                ${status && html`
                  <div className="p-2.5 rounded-xl text-[10px] font-bold ${status.type === 'success' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'} animate-fade-in">
                    ${status.msg}
                  </div>
                `}
              </div>

              <div className="pt-4 flex gap-2 shrink-0">
                <button 
                  onClick=${() => setSearchView('results')} 
                  className="flex-1 py-3 bg-white text-[#3182CE] border border-[#BEE3F8] rounded-xl font-bold text-[10px] active:scale-95 transition-all hover:bg-blue-50"
                >
                  취소
                </button>
                <button 
                  onClick=${handleFinalSubmit} 
                  disabled=${addingId}
                  className="flex-[2] py-3 bg-[#3182CE] text-white rounded-xl font-bold text-[10px] hover:bg-[#2B6CB0] active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  ${addingId ? html`<i className="fas fa-spinner fa-spin"></i>` : html`<i className="fas fa-save"></i>`} 저장하기
                </button>
              </div>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
};

export default App;
