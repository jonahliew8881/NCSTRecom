// app.js

let R_PAGE = 0, S_PAGE = 0;
const PAGE_SIZE = 15;
let currRec = [], currSearch = [];
let kFilter = '';
let cmpSlots = [null, null, null];
let cmpPickerSlot = 0;
let radarChartInstance = null;

// 將 DB 同 DETAIL 變為空陣列/物件，等待從 Google Sheet 下載
let DB = [];
let DETAIL = {};

// 你專屬的 Google Sheet CSV 連結
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2w7zSQ9eFV9MQh8Nry_kZIKincXaZ5Zv2jZ1ZYquemyvHdr5W-jtPljlVlheZ2A/pub?gid=1688070225&single=true&output=csv';

const TYPE_ICO = { '乾糧':'🟤', '罐頭':'🥫', '生肉糧':'🥩', '主食罐':'🥫' };
const R_COLOR = { 5:'#D97706', 4:'#2A4A6B', 3:'#5A7A98', 2:'#8AAAC8', 1:'#C5D8EC' };
const R_LABEL = { 5:'極佳', 4:'優良', 3:'良好', 2:'一般', 1:'較差' };
const BAD_INGREDIENTS = ['menadione', 'bha', 'bht', 'artificial color', 'meat by-products', 'poultry by-product', '甲萘醌', '人造色素', '肉類副產品', '家禽副產品', '味精', '大豆粉', '粟米', 'corn gluten', 'wheat gluten', '小麥麵筋'];

window.onload = () => {
    // 顯示載入中...
    const badge = document.getElementById('dbBadge');
    if(badge) badge.textContent = '🔄 讀取雲端數據中...';
    
    // 使用 PapaParse 讀取 Google Sheet CSV
    Papa.parse(CSV_URL, {
        download: true,
        header: true, // 自動認第一行做標題
        skipEmptyLines: true,
        complete: function(results) {
            const rows = results.data;
            
            // 將每一行資料轉換為 DB 和 DETAIL 格式
            rows.forEach((row, index) => {
                const id = index; 
                
                // 組合 DB 陣列 [0:id, 1:名, 2:種類, 3:主要成分, 4:蛋白, 5:碳水, 6:脂肪, 7:無穀, 8:評分, 9:不推薦, 10:產地, 11:磷, 12:卡路里, 13:圖片]
                DB.push([
                    id,
                    row['產品名稱'] ? row['產品名稱'].trim() : '未命名產品',
                    row['種類'] ? row['種類'].trim() : '乾糧',
                    row['主要成分'] || '',
                    parseFloat(row['蛋白質']) || null,
                    parseFloat(row['碳水']) || null,
                    parseFloat(row['脂肪']) || null,
                    parseInt(row['無穀物']) === 1 ? 1 : 0,
                    parseInt(row['評分']) || 3,
                    parseInt(row['不推薦']) === 1 ? 1 : 0,
                    row['產地'] || '產地不明',
                    parseFloat(row['磷']) || null,
                    row['卡路里'] || '',
                    row['圖片網址'] ? row['圖片網址'].trim() : ''
                ]);

                // 組合 DETAIL 詳情
                DETAIL[id] = {
                    i: row['成分表'] || '',
                    n: row['筆記'] || '',
                    t: row['牛磺酸'] || '',
                    s: row['鈉'] || '',
                    m: row['鎂'] || '',
                    // 👇 加入下面呢兩行，從 Google Sheet 讀取纖維同灰質 👇
                    fib: parseFloat(row['纖維']) || null,
                    ash: parseFloat(row['灰質']) || null
                };
            });

            // 數據載入完成，更新右上角數字
            if(badge) badge.textContent = `資料庫: ${DB.length} 款`;
            
            // 載入完成後渲染知識庫
            renderKnow(); 
        },
        error: function(err) {
            console.error('CSV 讀取失敗:', err);
            if(badge) badge.textContent = '⚠️ 載入失敗';
        }
    });
};

// ==========================================
// 下面保留你原本 app.js 嘅 function (gotoView, selNeed, triggerSearch 等等...)
// ==========================================

function gotoView(v) {
  document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(e => e.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  document.getElementById('tab-'+v).classList.add('active');
  window.scrollTo(0,0);
}

// ════════════════════════════════════════════════════
// 推薦功能邏輯
// ════════════════════════════════════════════════════
function selNeed(btn, v) {
  document.querySelectorAll('#needChips .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
  const tip = document.getElementById('needTip');
  const tips = {
    '腎病護理': '💡 腎病貓咪需要控制磷含量（建議 < 0.8%），並選擇優質蛋白質。',
    '泌尿問題': '💡 泌尿道問題需增加水分攝取，建議優先選擇主食罐。',
    '腸胃敏感': '💡 腸胃敏感建議選擇單一肉類蛋白，或含有益生菌的配方。',
    '減重': '💡 減重需注意碳水化合物比例（建議 < 15%）及整體卡路里。',
    '老貓護理': '💡 老貓活動量下降，需適度降低熱量，並注意關節與腎臟保養。',
    '毛皮健康': '💡 豐富的 Omega-3 (如魚油) 有助於亮澤毛髮及保護皮膚。'
  };
  if (tips[v]) { tip.innerHTML = tips[v]; tip.classList.add('show'); }
  else { tip.classList.remove('show'); }
}

function selAge(btn, v) {
  document.querySelectorAll('#ageChips .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
  const tip = document.getElementById('ageTip');
  if (v === '幼貓') { tip.innerHTML = '💡 幼貓發育需要較高蛋白質與熱量。'; tip.classList.add('show'); }
  else { tip.classList.remove('show'); }
}

function selType(btn, v) {
  document.querySelectorAll('#typeChips .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
}

function selMeat(btn) {
  document.querySelectorAll('#meatChips .chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
}

function doRecommend() {
  const need = document.querySelector('#needChips .chip.on').textContent.trim();
  const age = document.querySelector('#ageChips .chip.on').textContent.trim();
  const type = document.querySelector('#typeChips .chip.on').textContent.trim();
  const meat = document.querySelector('#meatChips .chip.on').getAttribute('data-val');

  let res = DB;

  // 1. 過濾糧食種類
  if (type !== '全部') {
    const t = type.replace(/🟤 |🥫 |🥩 /, '');
    res = res.filter(f => f[2].includes(t));
  }

  // 2. 過濾特殊需要
  if (need === '腎病護理') res = res.filter(f => f[11] !== null && f[11] <= 1.0);
  else if (need === '減重') res = res.filter(f => f[5] !== null && f[5] <= 15);
  else if (need === '腸胃敏感') res = res.filter(f => f[7] === 1);

  // 👇 3. 新增：過濾肉類
  if (meat) {
      const keywords = meat.split('|');
      res = res.filter(f => {
          const detail = DETAIL[f[0]] || {};
          const searchString = (f[1] + " " + (f[3]||"") + " " + (detail.n||"") + " " + (detail.i||"")).toLowerCase();
          return keywords.some(kw => searchString.includes(kw));
      });
  }

  // 預設評分排序
  res.sort((a,b) => b[8] - a[8]);

  currRec = res;
  R_PAGE = 1;
  document.getElementById('rec-form').style.display = 'none';
  document.getElementById('rec-results').style.display = 'block';
  renderCards(currRec.slice(0, PAGE_SIZE), 'recList');
  document.getElementById('recMore').style.display = res.length > PAGE_SIZE ? 'block' : 'none';
}

function backForm() {
  document.getElementById('rec-results').style.display = 'none';
  document.getElementById('rec-form').style.display = 'block';
}

function loadRecMore() {
  const next = currRec.slice(R_PAGE * PAGE_SIZE, (R_PAGE + 1) * PAGE_SIZE);
  renderCards(next, 'recList', true);
  R_PAGE++;
  if (R_PAGE * PAGE_SIZE >= currRec.length) document.getElementById('recMore').style.display = 'none';
}

// ════════════════════════════════════════════════════
// 渲染卡片邏輯 (支援新 UI)
// ════════════════════════════════════════════════════
function renderCards(list, containerId, append = false) {
  const container = document.getElementById(containerId);
  if (!list.length) {
    if(!append) container.innerHTML = '<div class="empty"><div class="ico">😿</div><p>找不到符合條件的貓糧</p></div>';
    return;
  }
  const html = list.map(f => {
    // 產品圖片 Fallback (假設 DB 第 14 個位置 f[13] 係圖片 URL)
    const imgUrl = f[13] ? f[13] : ''; 
    const fallbackIco = TYPE_ICO[f[2]] || '🐱';
    const imgHtml = imgUrl 
        ? `<img src="${imgUrl}" class="card-img" onerror="this.outerHTML='<span class=\\'card-img-fallback\\'>${fallbackIco}</span>'">`
        : `<span class="card-img-fallback">${fallbackIco}</span>`;

    const cls = f[9] ? ' danger' : '';
    const rC = R_COLOR[f[8]];
    const paws = [1,2,3,4,5].map(i => `<span class="pw ${i<=f[8]?'on':'off'}" style="color:${rC}">🐾</span>`).join('');
    
    let nH = '';
    if(f[4]) nH += `<div class="nut"><div class="nut-v ${f[4]>=45?'g':f[4]<30?'d':''}">${f[4]}%</div><div class="nut-l">蛋白</div></div>`;
    if(f[6]) nH += `<div class="nut"><div class="nut-v ${f[6]>=15?'g':f[6]<10?'d':''}">${f[6]}%</div><div class="nut-l">脂肪</div></div>`;
    if(f[5]) nH += `<div class="nut"><div class="nut-v ${f[5]<=10?'g':f[5]>=25?'d':''}">${f[5]}%</div><div class="nut-l">碳水</div></div>`;
    
    const isAdded = cmpSlots.some(s => s && s[0]===f[0]);

    return `
      <div class="card ${cls}">
        <div class="card-top" onclick="openDetail(${f[0]})" style="cursor:pointer">
          <div class="card-img-wrap ${f[2]==='乾糧'?'dry':f[2]==='罐頭'?'wet':'raw'}">
            ${imgHtml}
          </div>
          <div class="card-info">
            <div class="card-name">${f[1]}</div>
            <div class="card-meta">
              <span class="tag">${f[2]}</span>
              ${f[7] ? '<span class="tag gf">無穀物</span>' : ''}
              ${f[3] ? `<span>主成分: ${f[3]}</span>` : ''}
            </div>
            ${f[9] ? '<div class="not-rec">⚠️ 不推薦</div>' : ''}
            <div class="paws">${paws} <span class="rating-lbl" style="color:${rC}">${R_LABEL[f[8]]}</span></div>
          </div>
        </div>
        <div class="nutrients">${nH}</div>
        <button class="cmp-btn ${isAdded?'added':''}" id="cmpBtn-${f[0]}" onclick="addToCmp(${f[0]})">
          ${isAdded ? '✓ 已加入比較' : '＋ 加入比較'}
        </button>
      </div>`;
  }).join('');
  
  if (append) container.insertAdjacentHTML('beforeend', html);
  else container.innerHTML = html;
}

// ════════════════════════════════════════════════════
// 搜尋功能邏輯 (新增肉類篩選)
// ════════════════════════════════════════════════════
function triggerSearch() {
  const q = document.getElementById('sInput').value.trim().toLowerCase();
  const t = document.getElementById('fType').value;
  const g = document.getElementById('fGrain').value;
  const p = document.getElementById('fProt').value;
  const c = document.getElementById('fCarb').value;
  const meatEl = document.getElementById('fMeat');
  const meat = meatEl ? meatEl.value : '';
  const sort = document.getElementById('fSort').value;

  let res = DB;

  if(q) res = res.filter(f => f[1].toLowerCase().includes(q) || (f[3] && f[3].toLowerCase().includes(q)));
  if(t) res = res.filter(f => f[2].includes(t));
  if(g!=='') { const isGF = g==='1'; res = res.filter(f => f[7] === (isGF?1:0)); }
  if(p) { const target = parseInt(p); res = res.filter(f => f[4] && f[4] >= target); }
  if(c) { const target = parseInt(c); res = res.filter(f => f[5] && f[5] <= target); }
  
  // 肉類過濾邏輯
  if(meat) {
      const keywords = meat.split('|');
      res = res.filter(f => {
          const detail = DETAIL[f[0]] || {};
          const searchString = (f[1] + " " + (f[3]||"") + " " + (detail.n||"") + " " + (detail.i||"")).toLowerCase();
          return keywords.some(kw => searchString.includes(kw));
      });
  }

  if(sort === 'r') {
    res.sort((a,b) => {
      if(a[9] !== b[9]) return a[9] - b[9];
      if(b[8] !== a[8]) return b[8] - a[8];
      return (b[4]||0) - (a[4]||0);
    });
  } else if (sort === 'p') {
    res.sort((a,b) => (b[4]||0) - (a[4]||0));
  } else if (sort === 'c') {
    res.sort((a,b) => (a[5]!==null?a[5]:999) - (b[5]!==null?b[5]:999));
  }

  currSearch = res;
  S_PAGE = 1;
  document.getElementById('totalCount').textContent = res.length;
  renderCards(currSearch.slice(0, PAGE_SIZE), 'sList');
  document.getElementById('sMore').style.display = res.length > PAGE_SIZE ? 'block' : 'none';
}

function loadSMore() {
  const next = currSearch.slice(S_PAGE * PAGE_SIZE, (S_PAGE + 1) * PAGE_SIZE);
  renderCards(next, 'sList', true);
  S_PAGE++;
  if (S_PAGE * PAGE_SIZE >= currSearch.length) document.getElementById('sMore').style.display = 'none';
}

// ════════════════════════════════════════════════════
// 詳情視窗 (Detail Modal) - 升級版進度條 UI
// ════════════════════════════════════════════════════
function openDetail(oi) {
  const f = DB.find(x => x[0] === oi);
  if (!f) return;
  const d = DETAIL[oi];

  document.getElementById('dtTitle').textContent = f[1];
  document.getElementById('dtSub').textContent = `${f[10]||'產地不明'} · ${f[12]||'卡路里不明'}`;

  // 處理成分避雷針
  let safeIngredients = d && d.i ? escapeHtml(d.i) : '未有資料';
  if (d && d.i) {
      BAD_INGREDIENTS.forEach(bad => {
          const regex = new RegExp(bad, 'gi');
          safeIngredients = safeIngredients.replace(regex, `<span class="danger-text">$&</span>`);
      });
  }

let html = '';
  if (f[9] || (d && d.n && d.n.includes('不建議'))) {
    html += `<div class="ai-box" style="background:#FFFFA5;border-color:#FDE68A"><div class="ai-lbl" style="color:#D97706">⚠️ 注意事項</div><div class="ai-text">${d?d.n:'被標記為不推薦'}</div></div>`;
  } else if (d && d.n) {
    html += `<div class="ai-box"><div class="ai-lbl">筆記</div><div class="ai-text">${d.n}</div></div>`;
  }

  // === 1. 小資訊格 (產地、卡路里、牛磺酸、無穀物) ===
  html += `<div class="info-grid">
      <div class="info-box"><div class="info-lbl">🌍 產地</div><div class="info-val">${f[10] || '—'}</div></div>
      <div class="info-box"><div class="info-lbl">🔥 卡路里</div><div class="info-val">${f[12] || '—'}</div></div>
      <div class="info-box"><div class="info-lbl">🧪 牛磺酸</div><div class="info-val">${(d && d.t) ? d.t : '—'}</div></div>
      <div class="info-box"><div class="info-lbl">🌾 無穀物</div><div class="info-val">${f[7] ? '✅ 是' : '❌ 否'}</div></div>
  </div>`;

  // === 2. 營養進度條區塊 (雙排版 grid) ===
  html += `<div class="nut-grid-2">`;
  
  html += buildNutBar('蛋白質', f[4], { min: 0, max: 70, goodFrom: 45, goodTo: 100, midFrom: 30, midTo: 44.9, badRule: 'low', unit: '%', note: '幼貓建議>40%，成貓最少>30%。' });
  html += buildNutBar('脂肪', f[6], { min: 0, max: 30, goodFrom: 15, goodTo: 22, midFrom: 10, midTo: 14.9, badRule: 'both', unit: '%', note: '提供能量，減重貓可選10-12%。' });
  html += buildNutBar('碳水化合物', f[5], { min: 0, max: 50, goodFrom: 0, goodTo: 10, midFrom: 10.1, midTo: 24.9, badRule: 'high', unit: '%', note: '10%以下理想，過高增糖尿風險。' });
  html += buildNutBar('磷', f[11], { min: 0, max: 2.5, goodFrom: 0.8, goodTo: 1.2, midFrom: 0.5, midTo: 0.79, badRule: 'high', unit: '%', note: '健康貓0.8-1.2%，腎貓需<0.6%。' });

  // 讀取步驟2加入的纖維與灰質
  if(d && d.fib !== null) {
      html += buildNutBar('纖維', d.fib, { min: 0, max: 10, goodFrom: 0, goodTo: 3, midFrom: 3.1, midTo: 5, badRule: 'high', unit: '%', note: '過多(>5%)會影響營養吸收。' });
  }
  if(d && d.ash !== null) {
      html += buildNutBar('灰質', d.ash, { min: 0, max: 15, goodFrom: 0, goodTo: 8, midFrom: 8.1, midTo: 10, badRule: 'high', unit: '%', note: '高於10%可能使用較多骨頭等副產品。' });
  }
  
  html += `</div>`;

  // 加入圖表容器 (雷達圖)
  html += `<div class="chart-container" style="position:relative;height:200px;width:100%;margin-bottom:15px;"><canvas id="macroChart"></canvas></div>`;

  if (d) {
    html += collapsible('📖 完整成分表 (高亮爭議成分)', 'col-ing', safeIngredients, false); 
    if (d.t || d.s || d.m) {
      html += collapsible('🧪 其他微量元素', 'col-m', escapeHtml(`牛磺酸: ${d.t||'—'}\n鈉: ${d.s||'—'}\n鎂: ${d.m||'—'}`), false);
    }
  } else {
    html += `<p style="font-size:.8rem;color:var(--muted);text-align:center;margin-top:20px">暫無詳細成分資料</p>`;
  }

  document.getElementById('dtBody').innerHTML = html;
  document.getElementById('detailOverlay').classList.add('open');

  setTimeout(() => initRadarChart(f), 50); 
}

// === 新增：建立營養進度條的輔助函數 ===
function buildNutBar(title, value, rules) {
    let valStr = (value === null || value === undefined || value === '') ? '—' : value;
    let colorClass = 'val-none';
    let fillClass = 'fill-none';
    let percent = 0;

    if (valStr !== '—') {
        const v = parseFloat(value);
        // 計算長度比例 (上限不超過 100%)
        percent = Math.min((v / rules.max) * 100, 100);

        // 判斷顏色
        if (v >= rules.goodFrom && v <= rules.goodTo) {
            colorClass = 'val-good'; fillClass = 'fill-good';
        } else if (v >= rules.midFrom && v <= rules.midTo) {
            colorClass = 'val-mid'; fillClass = 'fill-mid';
        } else {
            colorClass = 'val-high'; fillClass = 'fill-high'; // 預設不在好同中，就係差/警告色
        }
    }

    return `
    <div class="nut-row">
        <div class="nut-header">
            <span class="nut-title">${title}</span>
            <span class="nut-val ${colorClass}">${valStr}${valStr !== '—' ? rules.unit : ''}</span>
        </div>
        <div class="nut-bar-wrap">
            <div class="nut-bar-fill ${fillClass}" style="width: ${percent}%"></div>
        </div>
        <div class="nut-ref">
            <span>0${rules.unit}</span>
            <span>理想: ${rules.goodFrom}-${rules.goodTo}${rules.unit}</span>
            <span>${rules.max}${rules.unit}+</span>
        </div>
        <div class="nut-note">${rules.note}</div>
    </div>
    `;
}

function initRadarChart(f) {
    const canvas = document.getElementById('macroChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (radarChartInstance) radarChartInstance.destroy();

    const isDry = f[2].includes('乾');
    const baseline = isDry ? [45, 20, 15] : [55, 25, 5]; 
    const productData = [f[4] || 0, f[6] || 0, f[5] || 0];

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['蛋白質', '脂肪', '碳水化合物'],
            datasets: [{
                label: '此產品',
                data: productData,
                backgroundColor: 'rgba(42, 74, 107, 0.2)',
                borderColor: 'rgba(42, 74, 107, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(42, 74, 107, 1)'
            }, {
                label: isDry ? '乾糧理想參考線' : '濕糧理想參考線',
                data: baseline,
                backgroundColor: 'rgba(45, 122, 79, 0.1)',
                borderColor: 'rgba(45, 122, 79, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5]
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(138, 170, 200, 0.2)' },
                    grid: { color: 'rgba(138, 170, 200, 0.2)' },
                    pointLabels: { font: { size: 12, family: "'Noto Sans TC', sans-serif" } },
                    ticks: { display: false, min: 0, max: 80 }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 10 } } }
            }
        }
    });
}

function collapsible(label, id, content, mono) {
  if(!content) return '';
  return `
  <div class="coll-hd" onclick="toggleColl('${id}',this)">
    <span>${label}</span>
    <span class="arr" id="arr-${id}">▼</span>
  </div>
  <div class="coll-body" id="${id}" style="${mono?'font-size:.7rem;font-family:monospace':''}">
    ${content}
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function toggleColl(id, hd) {
  const b = document.getElementById(id);
  const a = document.getElementById('arr-'+id);
  b.classList.toggle('open');
  if(a) a.classList.toggle('open');
}

function closeDetail(e) {
  if(e.target===document.getElementById('detailOverlay')) document.getElementById('detailOverlay').classList.remove('open');
}
function closeDetailBtn() {
  document.getElementById('detailOverlay').classList.remove('open');
}


// ════════════════════════════════════════════════════
// 比較功能邏輯
// ════════════════════════════════════════════════════
function addToCmp(oi) {
  const idx = cmpSlots.findIndex(s => s && s[0] === oi);
  if (idx !== -1) { removeCmpSlot(idx); return; }
  const emptyIdx = cmpSlots.findIndex(s => s === null);
  if (emptyIdx === -1) { alert('比較列表已滿（最多 3 款）'); return; }
  
  cmpSlots[emptyIdx] = DB.find(x => x[0] === oi);
  
  document.querySelectorAll(`#cmpBtn-${oi}`).forEach(btn => {
    btn.classList.add('added'); btn.textContent = '✓ 已加入比較';
  });
  updateCmpShelf();
}

function removeCmpSlot(slot) {
  const f = cmpSlots[slot];
  if (f) {
    document.querySelectorAll(`#cmpBtn-${f[0]}`).forEach(btn => {
      btn.classList.remove('added'); btn.textContent = '＋ 加入比較';
    });
  }
  cmpSlots[slot] = null;
  updateCmpShelf();
}

function openCmpPicker(slot) {
  cmpPickerSlot = slot;
  document.getElementById('pickerInput').value = '';
  document.getElementById('pickerList').innerHTML = '';
  document.getElementById('pickerOverlay').classList.add('open');
  setTimeout(() => document.getElementById('pickerInput').focus(), 100);
}

function closePicker(e) {
  if(e.target===document.getElementById('pickerOverlay')) document.getElementById('pickerOverlay').classList.remove('open');
}
function closePickerBtn() {
  document.getElementById('pickerOverlay').classList.remove('open');
}

function searchPicker() {
  const q = document.getElementById('pickerInput').value.trim().toLowerCase();
  const list = document.getElementById('pickerList');
  if (!q) { list.innerHTML = ''; return; }
  
  const res = DB.filter(f => f[1].toLowerCase().includes(q)).slice(0, 10);
  list.innerHTML = res.map(f => {
    if(cmpSlots.some(s => s && s[0]===f[0])) return `<div style="padding:10px;border-bottom:1px solid var(--border-ll);color:var(--muted);font-size:.8rem">${f[1]} (已加入)</div>`;
    return `<div style="padding:10px;border-bottom:1px solid var(--border-ll);color:var(--primary);font-size:.8rem;cursor:pointer" onclick="pickFood(${f[0]})">${f[1]}</div>`;
  }).join('');
}

function pickFood(oi) {
  cmpSlots[cmpPickerSlot] = DB.find(x => x[0] === oi);
  document.getElementById('pickerOverlay').classList.remove('open');
  document.querySelectorAll(`#cmpBtn-${oi}`).forEach(btn => {
    btn.classList.add('added'); btn.textContent = '✓ 已加入比較';
  });
  updateCmpShelf();
}

function updateCmpShelf() {
  let activeCount = 0;
  for (let i=0; i<3; i++) {
    const slot = document.getElementById('slot'+i);
    const f = cmpSlots[i];
    if (f) {
      activeCount++;
      slot.classList.add('filled');
      slot.innerHTML = `<div class="cmp-slot-name">${f[1]}</div><div class="cmp-slot-rm" onclick="removeCmpSlot(${i}); event.stopPropagation()">✕ 移除</div>`;
    } else {
      slot.classList.remove('filled');
      slot.innerHTML = `<span style="font-size:1.4rem">➕</span><span>選擇貓糧 ${i+1}</span>`;
    }
  }
  
  if (activeCount >= 2) renderCmpTable();
  else document.getElementById('cmpTable').innerHTML = `<div class="cmp-hint"><div class="ico">⚖️</div><div>請先選擇最少 2 款貓糧進行比較</div></div>`;
}

function renderCmpTable() {
  const active = cmpSlots.filter(s => s !== null);
  if (active.length < 2) return;
  
  let html = `<div class="cmp-table"><table class="cmp-tbl"><tr><th></th>`;
  active.forEach(f => html += `<th>${f[1]}</th>`);
  html += `</tr>`;
  
  const rows = [
    { l: '種類', k: 2 },
    { l: '主要蛋白質', k: 3 },
    { l: '無穀物', k: 7, fmt: v => v ? '✅' : '❌' },
    { l: '評分', k: 8, fmt: v => R_LABEL[v] || v },
    { l: '蛋白質 (%)', k: 4, cmp: 'max' },
    { l: '脂肪 (%)', k: 6, cmp: 'max' },
    { l: '碳水化合物 (%)', k: 5, cmp: 'min' },
    { l: '磷 (%)', k: 11, cmp: 'min' },
    { l: '產地', k: 10 }
  ];
  
  rows.forEach(r => {
    html += `<tr><td>${r.l}</td>`;
    let bestVal = null;
    if (r.cmp) {
      const vals = active.map(f => f[r.k]).filter(v => v !== null && v !== undefined);
      if (vals.length > 0) bestVal = r.cmp === 'max' ? Math.max(...vals) : Math.min(...vals);
    }
    
    active.forEach(f => {
      let v = f[r.k];
      let vStr = (v === null || v === undefined) ? '—' : (r.fmt ? r.fmt(v) : v);
      let cls = (r.cmp && v === bestVal && v !== null && v !== undefined) ? 'best' : '';
      html += `<td class="${cls}">${vStr}</td>`;
    });
    html += `</tr>`;
  });
  html += `</table></div>`;
  document.getElementById('cmpTable').innerHTML = html;
}

// ════════════════════════════════════════════════════
// 知識庫邏輯
// ════════════════════════════════════════════════════
function filterKnow(btn, cat) {
  document.querySelectorAll('#kCatFilter .k-cat').forEach(c => c.classList.remove('on'));
  btn.classList.add('on'); kFilter = cat; renderKnow();
}

function renderKnow() {
  const list = document.getElementById('knowList');
  const items = kFilter ? KNOW.filter(k => k.cat === kFilter) : KNOW;
  if (!items.length) { list.innerHTML = '<div class="empty"><div class="ico">📖</div><p>沒有相關知識</p></div>'; return; }

  list.innerHTML = items.map(k => {
    const ico = k.warn ? '⚠️' : k.cat==='腸胃健康' ? '🌿' : k.cat==='特殊需求' ? '⭐' : k.cat==='常見疾病' ? '🏥' : '💙';
    const cls = k.warn ? 'warn' : '';
    return `<button class="k-btn ${cls}" onclick="openKnow(${k.id})">
      <span class="k-btn-ico">${ico}</span>
      <div class="k-btn-text"><div class="k-btn-cat">${k.cat}</div><div class="k-btn-q">${k.q}</div></div>
      <span style="color:var(--muted);font-size:.8rem">›</span>
    </button>`;
  }).join('');
}

function openKnow(id) {
  const k = KNOW.find(x => x.id === id);
  if (!k) return;
  document.getElementById('kTitle').textContent = k.q;
  document.getElementById('kSub').textContent = k.cat;
  document.getElementById('kBody').innerHTML = `<div style="font-size:.82rem;line-height:1.7;color:var(--text)">${k.body}</div>`;
  document.getElementById('knowOverlay').classList.add('open');
}

function closeKnow(e) { if(e.target===document.getElementById('knowOverlay')) document.getElementById('knowOverlay').classList.remove('open'); }
function closeKnowBtn() { document.getElementById('knowOverlay').classList.remove('open'); }