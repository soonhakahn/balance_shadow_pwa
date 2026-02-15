const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

function esc(s){
  return (s||'').replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function norm(s){
  return (s||'').toLowerCase().replace(/\s+/g,' ').trim();
}

function tradingViewIframe(symbol){
  // symbol example: KRX:005930
  const url = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=D&range=12M&hidetoptoolbar=1&symboledit=0&saveimage=0&toolbarbg=0b1020&studies=[]&theme=dark&style=1&timezone=Asia%2FSeoul`;
  return `<iframe loading="lazy" width="100%" height="220" src="${url}"></iframe>`;
}

let NAME_TO_CODE = {};

async function loadNameMap(bust=false){
  try{
    const ts = bust ? `?ts=${Date.now()}` : '';
    const res = await fetch(`./reports/name_to_code.json${ts}`, { cache: 'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    NAME_TO_CODE = data.nameToCode || {};
    return { ok:true, meta: `${data.bizday||''} · ${data.count||0} tickers` };
  }catch(e){
    NAME_TO_CODE = {};
    return { ok:false, meta: `name map load failed: ${String(e)}` };
  }
}

async function loadLatest(bust=false){
  const ts = bust ? `?ts=${Date.now()}` : '';
  const res = await fetch(`./reports/latest.json${ts}`, { cache: 'no-store' });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildThemeIndex(items){
  const map = new Map();
  for (const it of items){
    const theme = (it.theme||'').trim() || '기타';
    const arr = map.get(theme) || [];
    arr.push(it);
    map.set(theme, arr);
  }
  return map;
}

function renderTop30(data){
  $('#top30meta').textContent = `${data.date||'-'} · ${data.title||''} · ${data.source||''}`;
  const list = $('#top30list');
  list.innerHTML = '';
  for (const it of data.items||[]){
    const el = document.createElement('div');
    el.className='item';
    el.innerHTML = `
      <div class="top">
        <div><b>${it.rank}.</b> ${esc(it.name)} <span class="badge">${esc(it.theme||'-')}</span></div>
        <span class="badge">${it.pct.toFixed(2)}%</span>
      </div>
      <div class="small" style="margin-top:6px">${esc((it.raw||'').slice(0,160))}${(it.raw||'').length>160?'…':''}</div>
    `;
    list.appendChild(el);
  }
}

function renderDictionary(themeMap){
  const wrap = $('#dict');
  wrap.innerHTML='';
  const themes = Array.from(themeMap.keys()).sort((a,b)=> themeMap.get(b).length - themeMap.get(a).length);
  for (const t of themes){
    const items = themeMap.get(t);
    const names = Array.from(new Set(items.map(x=>x.name))).slice(0,30);
    const el = document.createElement('div');
    el.className='item';
    el.innerHTML = `
      <div class="top">
        <div><b>${esc(t)}</b> <span class="badge">${items.length} entries</span></div>
      </div>
      <div class="small" style="margin-top:6px">${names.map(esc).join(', ')}</div>
    `;
    wrap.appendChild(el);
  }
}

function renderSearchResults(q, themeMap){
  const out = $('#out');
  const qq = norm(q);
  if(!qq){ out.innerHTML = '<div class="small">키워드를 입력하세요.</div>'; return; }

  // match themes by substring
  const hitThemes = Array.from(themeMap.keys()).filter(t=> norm(t).includes(qq)).slice(0,8);

  // if no theme hit, fallback: search raw text
  let items = [];
  if(hitThemes.length){
    for (const t of hitThemes) items = items.concat(themeMap.get(t));
  } else {
    for (const arr of themeMap.values()){
      for (const it of arr){
        if(norm(it.raw).includes(qq) || norm(it.name).includes(qq)) items.push(it);
      }
    }
    items = items.slice(0,20);
  }

  if(!items.length){
    out.innerHTML = '<div class="small">매칭 결과 없음. (키워드를 더 짧게/일반적으로 해보세요)</div>';
    return;
  }

  // group by theme
  const g = new Map();
  for (const it of items){
    const t = it.theme || '기타';
    const arr = g.get(t) || [];
    arr.push(it);
    g.set(t, arr);
  }

  out.innerHTML = '';
  for (const [t, arr] of Array.from(g.entries()).sort((a,b)=>b[1].length-a[1].length)){
    const uniq = new Map();
    for (const it of arr){
      if(!uniq.has(it.name)) uniq.set(it.name, it);
    }
    const picks = Array.from(uniq.values()).slice(0,10);

    const el = document.createElement('div');
    el.className='item';
    el.innerHTML = `
      <div class="top">
        <div><b>${esc(t)}</b> <span class="badge">${picks.length} 종목</span></div>
      </div>
      <div class="list" style="margin-top:10px">
        ${picks.map(p=>{
          const code = NAME_TO_CODE[p.name];
          const tv = code ? tradingViewIframe(`KRX:${code}`) : '<div class="small">(차트: 코드 매핑 필요)</div>';
          return `
            <div class="item">
              <div class="top">
                <div><b>${esc(p.name)}</b> ${code?`<code>${code}</code>`:''}</div>
                <span class="badge">${p.pct.toFixed(2)}%</span>
              </div>
              <div class="small" style="margin-top:6px">${esc((p.raw||'').slice(0,140))}${(p.raw||'').length>140?'…':''}</div>
              <div style="margin-top:10px">${tv}</div>
            </div>`;
        }).join('')}
      </div>
    `;
    out.appendChild(el);
  }
}

function bindTabs(){
  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const tab = btn.dataset.tab;
      $$('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
      $('#panel-search').style.display = tab==='search' ? '' : 'none';
      $('#panel-top30').style.display = tab==='top30' ? '' : 'none';
      $('#panel-dictionary').style.display = tab==='dictionary' ? '' : 'none';
      $('#panel-settings').style.display = tab==='settings' ? '' : 'none';
    });
  });
}

let latest;
let themeMap;

async function init(){
  bindTabs();
  const nm = await loadNameMap(false);
  latest = await loadLatest(false);
  $('#meta').textContent = `${latest.date||'-'} · items ${latest.items?.length||0} · ${nm.meta}`;
  themeMap = buildThemeIndex(latest.items||[]);
  renderTop30(latest);
  renderDictionary(themeMap);

  $('#run').addEventListener('click', ()=>{
    renderSearchResults($('#q').value, themeMap);
  });
  $('#refresh').addEventListener('click', async ()=>{
    const nm2 = await loadNameMap(true);
    latest = await loadLatest(true);
    $('#meta').textContent = `${latest.date||'-'} · items ${latest.items?.length||0} · ${nm2.meta}`;
    themeMap = buildThemeIndex(latest.items||[]);
    renderTop30(latest);
    renderDictionary(themeMap);
    alert('갱신 완료');
  });

  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('./sw.js'); }catch(e){}
  }
}

init();
