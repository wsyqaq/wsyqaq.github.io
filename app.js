'use strict';
/* ============================================================
   Chiikawa 食谱 · 应用逻辑
   依赖:data.js(INGS / RECIPES / BONDS / LINES / CITIES / PRAISE / DAILY_WHY)
   ============================================================ */

/* ================= 状态(本地保存) ================= */
const KEY = 'miso.v1';
const DEFAULTS = {picked:[], hearts:[], cooked:0, cookedIds:[], achv:[], theme:'orange', name:'lty', first:Date.now()};
let S;
try{ S = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY)||'{}')); }
catch(e){ S = Object.assign({}, DEFAULTS); }
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} };
if(S.name === 'Iyy'){ S.name = 'lty'; save(); } /* 旧默认名迁移 */

/* ================= 小工具 ================= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ING_OF = Object.fromEntries(INGS.map(i => [i.id, i]));

let toastTimer;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}
function vib(p){ try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }

/* 打开弹层时锁定背景滚动,防止页面乱动 */
let savedScrollY = 0;
function lockScroll(){
  savedScrollY = window.scrollY;
  document.body.style.top = (-savedScrollY) + 'px';
  document.body.classList.add('locked');
}
function unlockScroll(){
  document.body.classList.remove('locked');
  document.body.style.top = '';
  window.scrollTo({top:savedScrollY});
}

const LV_TEXT = {easy:'简单', medium:'中等', hard:'有挑战'};
const lvTag = l => `<span class="tag ${l}">${LV_TEXT[l]}</span>`;
const cuisineLabel = {japanese:'日料',chinese:'中餐',korean:'韩料',thai:'泰式',italian:'意式',western:'西餐',indian:'印度',southeast:'东南亚',light:'减脂餐',dessert:'甜点'};

/* ================= 步骤图文小助手 ================= */
const STEP_ACTIONS = [
  ['冷藏','🧊'],['冰水','🧊'],['冻结','🧊'],['冰箱','🧊'],['回温','⏰'],
  ['发酵','🍞'],['揉','🍞'],['面团','🍞'],['面包糠','🍞'],
  ['蒸','♨️'],['水开','♨️'],
  ['炸','🍟'],['油温','🍟'],['复炸','🍟'],
  ['烤','🔥'],['烤箱','🔥'],['预热','🔥'],
  ['糖色','🍬'],
  ['煎','🍳'],['炒','🍳'],['爆香','🍳'],['煸炒','🍳'],['滑炒','🍳'],
  ['炖','🍲'],['焖','🍲'],['煮','🍲'],['熬','🍲'],['高汤','🍲'],['汤底','🍲'],
  ['焯水','💦'],['焯','💦'],['烫','💦'],['泡','💦'],['冲洗','💦'],['水浴','💦'],
  ['腌','🧂'],['调味','🧂'],['加盐','🧂'],['酱油','🧂'],['鱼露','🧂'],
  ['切','🔪'],['丁','🔪'],['丝','🔪'],['片','🔪'],['块','🔪'],['剁','🔪'],['拍松','🔪'],['去壳','🔪'],['开背','🔪'],['剥','🔪'],['划','🔪'],
  ['打蛋','🥚'],['打散','🥚'],['蛋液','🥚'],
  ['拌','🥣'],['搅','🥣'],['翻匀','🥣'],['裹','🥣'],['调匀','🥣'],['调碗汁','🥣'],
  ['倒','💧'],['淋','💧'],['挤','💧'],['加水','💧'],
  ['刷','🖌️'],['抹','🖌️'],
  ['撒','✨'],['芝麻','✨'],
  ['装盘','🍽️'],['摆盘','🍽️'],['装碗','🍽️'],['盛','🍽️'],['码','🍽️'],['铺','🍽️'],['叠','🍽️'],['摆','🍽️'],
  ['卷','🌯'],['包','🥟'],['捏','🥟'],['团成','🥟'],['丸','🥟'],
  ['微波','⚡'],['静置','⏰'],['静止','⏰'],['醒','⏰'],
];
const ING_ALIAS = {
  pork:['肉末','五花肉','里脊','肉片'], garlic:['蒜'], chicken:['鸡'], beef:['牛'],
  shrimp:['虾'], rice:['冷饭','香米','生米','糯米'], egg:['蛋'], cheese:['芝士'],
  milk:['奶'], butter:['黄油'], scallion:['葱'],
};
function stepEmoji(text){
  for(const p of STEP_ACTIONS){ if(text.includes(p[0])) return p[1]; }
  return '🍽️';
}
function stepHints(text){
  const hints = [];
  const rng = text.match(/(\d+)\s*[-~到]\s*(\d+)\s*分钟/);
  const min = rng || text.match(/(\d+)\s*分钟/);
  if(min){ hints.push(rng ? `⏱ ${min[1]}-${min[2]} 分钟` : `⏱ ${min[1]} 分钟`); }
  else{ const hr = text.match(/([\d.]+)\s*小时/); if(hr) hints.push(`⏱ ${hr[1]} 小时`); }
  if(!min && !hints.length){ const sec = text.match(/(\d+)\s*秒/); if(sec) hints.push(`⏱ ${sec[1]} 秒`); }
  const fire = text.match(/(大火|中火|小火|微火)/); if(fire) hints.push(`🔥 ${fire[1]}`);
  const temp = text.match(/(\d+)\s*°C/); if(temp) hints.push(`🌡 ${temp[1]}°C`);
  return hints;
}
function stepIngs(text){
  return INGS.filter(i => text.includes(i.label) || (ING_ALIAS[i.id]||[]).some(a => text.includes(a))).slice(0,5);
}

/* ================= 数据推导 ================= */
function missingOf(r){ return r.ings.filter(id => !S.picked.includes(id)); }
function canMake(r){ return missingOf(r).length === 0; }
function makableCount(){ return RECIPES.filter(r => canMake(r)).length; }
function cookedCuisines(){ return new Set(S.cookedIds.map(id => { const r = RECIPES.find(x => x.id === id); return r ? r.cuisine : '?'; })); }
function bondLv(){
  let lv = 0;
  BONDS.forEach((b,i) => { if(S.cooked >= b.at) lv = i; });
  return lv;
}

/* ================= 渲染:食材页 ================= */
const CATS = [
  {filter:'hot',      label:'🍳 热门'},
  {filter:'vegetable',label:'🥬 蔬菜'},
  {filter:'protein',  label:'🥩 肉蛋'},
  {filter:'seafood',  label:'🦐 海鲜'},
  {filter:'staple',   label:'🍚 主食'},
  {filter:'dairy',    label:'🧀 乳品'},
  {filter:'fruit',    label:'🍌 水果'},
];
function renderChipsMatch(){
  $('#chips-match').innerHTML = CATS.map(c => {
    const n = c.filter === 'hot' ? INGS.filter(i => i.hot).length : INGS.filter(i => i.cat === c.filter).length;
    return `<button class="chip ${c.filter==='hot'?'on':''}" data-filter="${c.filter}">${c.label}<i class="c-num">${n}</i></button>`;
  }).join('');
}
function renderIngs(){
  $('#ing-grid').innerHTML = INGS.map(i => `
    <button class="ing-card ${S.picked.includes(i.id)?'on':''}" data-id="${i.id}" data-cat="${i.cat}" data-kw="${esc(i.kw)} ${esc(i.label)}">
      <span class="plus">${S.picked.includes(i.id)?'✓':'+'}</span>
      <span class="emoji">${i.emoji}</span>
      <span class="label">${esc(i.label)}</span>
    </button>`).join('');
}
function renderPickedRow(){
  const row = $('#picked-row');
  if(!S.picked.length){ row.innerHTML = ''; return; }
  row.innerHTML = S.picked.map(id => {
    const i = ING_OF[id]; if(!i) return '';
    return `<button class="pick-pill" data-id="${id}">${i.emoji} ${esc(i.label)}<i>✕</i></button>`;
  }).join('') + `<button class="pick-pill clear" id="clear-pick">🧹 清空</button>`;
}
function refreshMatchUI(){
  const n = makableCount();
  const btn = $('#find-btn');
  btn.disabled = S.picked.length === 0;
  btn.classList.toggle('ready', S.picked.length > 0);
  $('#find-cnt').textContent = `${n} 道能做`;
  const sub = $('#pick-sub');
  sub.innerHTML = S.picked.length === 0
    ? '点选你有的食材'
    : `已选 <b>${S.picked.length}</b> 种 · 能做 <b>${n}</b> 道`;
  renderPickedRow();
}

/* ================= 食材页:分类 + 搜索筛选 ================= */
const mState = {q:'', cat:'hot'};
function applyIngFilter(){
  $$('#ing-grid > *').forEach(card => {
    const ing = ING_OF[card.dataset.id];
    const okCat = mState.cat === 'all' || (mState.cat === 'hot' ? !!(ing && ing.hot) : card.dataset.cat === mState.cat);
    const okQ = !mState.q || (card.dataset.kw || '').toLowerCase().includes(mState.q);
    card.style.display = (okCat && okQ) ? '' : 'none';
  });
}
$('#chips-match').addEventListener('click', e => {
  const chip = e.target.closest('.chip'); if(!chip) return;
  $$('#chips-match .chip').forEach(c => c.classList.toggle('on', c === chip));
  mState.cat = chip.dataset.filter;
  vib(8); applyIngFilter();
});
$('#q-match').addEventListener('input', () => {
  mState.q = $('#q-match').value.trim().toLowerCase();
  $('#q-match').closest('.search').classList.toggle('has', !!$('#q-match').value);
  applyIngFilter();
});
$('#q-match').closest('.search').querySelector('.clear').addEventListener('click', () => {
  mState.q = ''; $('#q-match').value = '';
  $('#q-match').closest('.search').classList.remove('has');
  applyIngFilter();
});

/* ================= 事件:食材页 ================= */
$('#ing-grid').addEventListener('click', e => {
  const card = e.target.closest('.ing-card'); if(!card) return;
  const id = card.dataset.id;
  const on = !S.picked.includes(id);
  if(on) S.picked.push(id); else S.picked = S.picked.filter(x => x !== id);
  card.classList.toggle('on', on);
  card.querySelector('.plus').textContent = on ? '✓' : '+';
  vib(8); save(); refreshMatchUI(); checkAchv(); renderRecipes();
});
$('#picked-row').addEventListener('click', e => {
  const pill = e.target.closest('.pick-pill'); if(!pill) return;
  if(pill.id === 'clear-pick'){ S.picked = []; vib(12); toast('🧹 已清空选中的食材'); }
  else{
    S.picked = S.picked.filter(x => x !== pill.dataset.id);
    const card = $('#ing-grid').querySelector(`[data-id="${pill.dataset.id}"]`);
    if(card){ card.classList.remove('on'); card.querySelector('.plus').textContent = '+'; }
  }
  save(); refreshMatchUI(); renderRecipes();
});
$('#find-btn').addEventListener('click', () => {
  go('recipes');
  rState.sort = 'best'; rState.qf.add('canmake'); syncQfUI();
  const n = makableCount();
  say(n > 0 ? `用你选的食材,能做 ${n} 道菜!已按能做排序~` : '这些食材还凑不齐一道菜,再多选一点?');
});

/* ================= 食谱页:筛选 / 排序 / 渲染 ================= */
const rState = {q:'', cuisine:'all', qf:new Set(), sort:'default'};
const SORTS = {default:'↕ 默认', time:'⏱ 用时短', easy:'👌 简单优先', best:'✓ 能做优先'};
const CUISINES = [
  {filter:'japanese', label:'🇯🇵 日料'},
  {filter:'chinese',  label:'🇨🇳 中餐'},
  {filter:'korean',   label:'🇰🇷 韩料'},
  {filter:'thai',     label:'🇹🇭 泰式'},
  {filter:'italian',  label:'🇮🇹 意式'},
  {filter:'western',  label:'🍴 西餐'},
  {filter:'indian',   label:'🇮🇳 印度'},
  {filter:'southeast',label:'🌏 东南亚'},
  {filter:'light',    label:'🥗 减脂餐'},
  {filter:'dessert',  label:'🍰 甜点'},
];

function recipeKw(r){
  return r.name + ' ' + cuisineLabel[r.cuisine] + ' ' + r.ings.map(id => ING_OF[id] ? ING_OF[id].label : '').join(' ');
}
function visibleList(){
  let list = RECIPES.filter(r =>
    (rState.cuisine === 'all' || r.cuisine === rState.cuisine) &&
    (!rState.q || recipeKw(r).toLowerCase().includes(rState.q))
  );
  if(rState.qf.has('canmake') && S.picked.length) list = list.filter(canMake);
  if(rState.qf.has('easy'))    list = list.filter(r => r.level === 'easy');
  if(rState.qf.has('time30'))  list = list.filter(r => r.time <= 30);
  const lvOrder = {easy:0, medium:1, hard:2};
  if(rState.sort === 'time')       list = list.slice().sort((a,b) => a.time - b.time);
  else if(rState.sort === 'easy')  list = list.slice().sort((a,b) => lvOrder[a.level] - lvOrder[b.level] || a.time - b.time);
  else if(rState.sort === 'best')  list = list.slice().sort((a,b) => (missingOf(a).length - missingOf(b).length) || a.time - b.time);
  return list;
}
function renderRecipes(){
  const list = visibleList();
  const grid = $('#recipe-grid');
  grid.innerHTML = list.map(r => {
    const miss = missingOf(r);
    const cooked = S.cookedIds.includes(r.id);
    let status = '';
    if(S.picked.length > 0){
      status = miss.length === 0
        ? '<span class="tag ok">✓ 可制作</span>'
        : `<span class="tag miss">缺 ${miss.length} 样</span>`;
    }
    return `
    <article class="recipe" data-id="${r.id}" data-cuisine="${r.cuisine}">
      <div class="photo" style="background:linear-gradient(155deg,${r.bg[0]},${r.bg[1]})">
        <span class="e">${r.emoji}</span>
        <span class="flag">${cuisineLabel[r.cuisine]}</span>
        ${cooked?'<span class="cooked-mark">✓ 做过</span>':''}
      </div>
      <button class="heart ${S.hearts.includes(r.id)?'on':''}" data-id="${r.id}" aria-label="收藏">${S.hearts.includes(r.id)?'❤️':'♡'}</button>
      <div class="r-body">
        <h3 style="color:${r.color}">${esc(r.name)}</h3>
        <div class="tags">${lvTag(r.level)}<span class="tag time">⏱ ${r.time} 分</span>${r.kcal?`<span class="tag kcal">🔥 ${r.kcal} kcal</span>`:''}</div>
        ${status?`<div class="tags" style="margin-top:7px">${status}</div>`:''}
      </div>
    </article>`;
  }).join('');
  const can = list.filter(canMake).length;
  $('#recipes-sub').innerHTML = S.picked.length
    ? `共 <b>${list.length}</b> 道 · 可做 <b>${can}</b> 道`
    : `共 <b>${list.length}</b> 道菜`;
  $('#recipes-empty').classList.toggle('show', list.length === 0);
}
function syncQfUI(){
  $$('#chips-qf .qf').forEach(c => c.classList.toggle('on', rState.qf.has(c.dataset.qf)));
  $('#sort-btn').textContent = SORTS[rState.sort] || SORTS.default;
}
$('#chips-recipes').addEventListener('click', e => {
  const chip = e.target.closest('.chip'); if(!chip) return;
  $$('#chips-recipes .chip').forEach(c => c.classList.toggle('on', c === chip));
  rState.cuisine = chip.dataset.filter;
  vib(8); renderRecipes();
});
$('#chips-qf').addEventListener('click', e => {
  const btn = e.target.closest('button'); if(!btn) return;
  if(btn.id === 'sort-btn'){
    const order = ['default','time','easy','best'];
    rState.sort = order[(order.indexOf(rState.sort)+1) % order.length];
    syncQfUI(); renderRecipes();
    toast('排序:' + SORTS[rState.sort].replace(/^\S+\s/,''));
    return;
  }
  if(btn.id === 'random-btn'){ randomPick(); return; }
  const f = btn.dataset.qf;
  if(rState.qf.has(f)) rState.qf.delete(f); else rState.qf.add(f);
  vib(8); syncQfUI(); renderRecipes();
});
$('#q-recipes').addEventListener('input', () => {
  rState.q = $('#q-recipes').value.trim().toLowerCase();
  $('#q-recipes').closest('.search').classList.toggle('has', !!$('#q-recipes').value);
  renderRecipes();
});
$('#q-recipes').closest('.search').querySelector('.clear').addEventListener('click', () => {
  rState.q = ''; $('#q-recipes').value = ''; $('#q-recipes').closest('.search').classList.remove('has');
  renderRecipes();
});
function randomPick(){
  const list = visibleList();
  const pool = list.length ? list : RECIPES;
  const r = pool[Math.floor(Math.random()*pool.length)];
  openSheet(r);
  say('骰子说了算!今天做「' + r.name + '」🎲', 4000);
  vib(15);
}

/* ================= 每日推荐横幅 ================= */
function renderDaily(){
  const d = new Date();
  const seed = d.getFullYear()*372 + (d.getMonth()+1)*31 + d.getDate();
  const r = RECIPES[seed % RECIPES.length];
  const why = DAILY_WHY[seed % DAILY_WHY.length];
  $('#daily-slot').innerHTML = `
    <button class="daily pressable" id="daily-banner" style="background:linear-gradient(120deg,${r.bg[0]},${r.bg[1]})">
      <span class="d-info">
        <span class="d-badge">📌 今日推荐 · ${d.getMonth()+1}月${d.getDate()}日</span>
        <span class="d-name" style="color:${r.color}">${esc(r.name)}</span>
        <span class="d-why">${why}</span>
      </span>
      <span class="d-emoji">${r.emoji}</span>
    </button>`;
  $('#daily-banner').addEventListener('click', () => openSheet(r));
}

/* ================= 收藏 ================= */
function toggleHeart(id){
  const on = !S.hearts.includes(id);
  if(on) S.hearts.push(id); else S.hearts = S.hearts.filter(x => x !== id);
  vib(on ? [12,40,12] : 8); save();
  $$(`.heart[data-id="${id}"]`).forEach(h => { h.classList.toggle('on', on); h.textContent = on ? '❤️' : '♡'; });
  toast(on ? '❤️ 已收藏「' + (RECIPES.find(x=>x.id===id)||{}).name + '」' : '已取消收藏');
  checkAchv(); renderMe();
}

/* ================= 详情抽屉 & 做菜模式 ================= */
let cur = null;
const cook = {mode:false, idx:0, done:new Set()};

function openSheet(r){
  cur = r; cook.mode = false; cook.idx = 0; cook.done = new Set();
  $('#sheet').classList.remove('cooking');
  $('#sh-head').style.background = `linear-gradient(155deg,${r.bg[0]},${r.bg[1]})`;
  $('#sh-emoji').textContent = r.emoji;
  renderDetail();
  lockScroll();
  $('#veil').classList.add('show');
  $('#sheet').classList.add('show');
}
function renderDetail(){
  const r = cur;
  const miss = missingOf(r);
  $('#sheet-fill').innerHTML = `
    <h2 id="sh-name">${esc(r.name)}</h2>
    <p class="sheet-intro">${esc(r.intro)}</p>
    <div class="tags" id="sh-tags">
      ${lvTag(r.level)}<span class="tag time">⏱ ${r.time} 分钟</span>${r.kcal?`<span class="tag kcal">🔥 约 ${r.kcal} kcal / 份</span>`:''}
      ${miss.length === 0 ? '<span class="tag ok">✓ 可制作</span>' : `<span class="tag miss">缺 ${miss.length} 样食材</span>`}
    </div>
    <div class="list-title">🧺 需要的食材 <span class="hint">点一下 = 家里有</span></div>
    <div class="ing-list" id="sh-ings">
      ${r.ings.map(id => {
        const ing = ING_OF[id]; const has = S.picked.includes(id);
        return `<button class="ing-pill ${has?'ok':'miss'}" data-id="${id}">${has?'✓':'○'} ${ing.emoji} ${esc(ing.label)}</button>`;
      }).join('')}
    </div>
    ${miss.length ? `<button class="go-miss pressable" data-act="go-miss">🛒 还缺 ${miss.length} 样 · 去补货 →</button>` : ''}
    <div class="list-title">👩‍🍳 步骤 <span class="hint">共 ${r.steps.length} 步 · 做菜模式里逐步打卡</span></div>
    <div class="steps">
      ${r.steps.map((s,i) => `
        <div class="step ${cook.done.has(i)?'done':''}">
          <span class="no">${i+1}</span><p>${esc(s)}</p><span class="step-ico">${stepEmoji(s)}</span>
        </div>`).join('')}
    </div>`;
  updateCookBar();
}
function renderCook(){
  const r = cur;
  $('#sheet').classList.add('cooking');
  cook.mode = true;
  if(cook.idx >= r.steps.length){
    $('#sheet-fill').innerHTML = `
      <div class="cook-view final">
        <div class="cv-big">🎉</div>
        <h2>全部完成!</h2>
        <p class="cv-sub">${esc(r.name)} 已经上桌,吉伊闻到香味啦~</p>
        <button class="cv-btn main wide" data-act="finish">开吃!完成这道菜 🍽️</button>
      </div>`;
    celebrate();
    return;
  }
  const step = r.steps[cook.idx];
  const hints = stepHints(step);
  const used = stepIngs(step);
  $('#sheet-fill').innerHTML = `
    <div class="cook-view">
      <div class="cv-top">
        <button class="cv-exit" data-act="exit">← 退出做菜</button>
        <span class="cv-stepnum">第 ${cook.idx+1} / ${r.steps.length} 步</span>
      </div>
      <button class="cv-card pressable" data-act="done">
        <div class="cv-toprow">
          <span class="cv-no">${cook.idx+1}</span>
          <span class="cv-scene-emo" title="这一步的关键动作">${stepEmoji(step)}</span>
        </div>
        <p>${esc(step)}</p>
        ${hints.length?`<div class="cv-hints">${hints.map(x => `<i>${x}</i>`).join('')}</div>`:''}
        ${used.length?`<div class="cv-ings">${used.map(i => `<i>${i.emoji} ${esc(i.label)}</i>`).join('')}</div>`:''}
        <span class="cv-tip">点卡片或下方按钮 = 完成这一步</span>
      </button>
      <div class="cv-dots">${r.steps.map((_,i) => `<i class="${cook.done.has(i)?'ok':''} ${i===cook.idx?'now':''}"></i>`).join('')}</div>
      <div class="cv-actions">
        <button class="cv-btn ghost" data-act="prev" ${cook.idx===0?'disabled':''}>← 上一步</button>
        <button class="cv-btn main" data-act="done">✓ 完成这步</button>
      </div>
    </div>`;
  updateCookBar();
}
function updateCookBar(){
  const btn = $('#cook-btn');
  if(cook.mode){
    $('#ck-label').textContent = '做菜进行中';
    $('#ck-count').textContent = `${cook.done.size} / ${cur.steps.length}`;
    $('#ck-fill').style.width = (cook.done.size / cur.steps.length * 100).toFixed(0) + '%';
  }else{
    $('#ck-label').textContent = '一起做菜';
    $('#ck-count').textContent = `0 / ${cur.steps.length}`;
    $('#ck-fill').style.width = '0%';
    btn.textContent = canMake(cur) ? '开始一起做菜 →' : '🛒 食材不够,去补货';
  }
}
$('#cook-btn').addEventListener('click', () => {
  if(!canMake(cur)){ go('match'); pulseMissing(missingOf(cur)); closeSheet(); say('选齐食材就能开做啦!'); return; }
  cook.mode = true; cook.idx = 0; cook.done = new Set();
  renderCook();
  say('跟着步骤来,我陪着你 👨‍🍳', 5000);
  vib(12);
});
$('#sheet').addEventListener('click', e => {
  const act = e.target.closest('[data-act]');
  if(!act) return;
  const a = act.dataset.act;
  if(a === 'close'){ closeSheet(); return; }
  if(a === 'pill'){ /* 食材点选 */ }
  if(a === 'go-miss'){ go('match'); pulseMissing(missingOf(cur)); closeSheet(); return; }
  if(a === 'prev' && cook.idx > 0){ cook.idx--; renderCook(); vib(8); return; }
  if(a === 'done'){
    cook.done.add(cook.idx); vib(12);
    cook.idx++;
    renderCook();
    return;
  }
  if(a === 'exit'){ cook.mode = false; $('#sheet').classList.remove('cooking'); renderDetail(); return; }
  if(a === 'finish'){ finishCook(); return; }
});
$('#sheet').addEventListener('click', e => {
  const pill = e.target.closest('.ing-pill'); if(!pill) return;
  const id = pill.dataset.id;
  const on = !S.picked.includes(id);
  if(on) S.picked.push(id); else S.picked = S.picked.filter(x => x !== id);
  const card = $('#ing-grid').querySelector(`[data-id="${id}"]`);
  if(card){ card.classList.toggle('on', on); card.querySelector('.plus').textContent = on ? '✓' : '+'; }
  vib(8); save(); refreshMatchUI(); checkAchv();
  renderRecipes();
  const r = cur, miss = missingOf(r);
  $('#sh-tags').innerHTML = lvTag(r.level) + `<span class="tag time">⏱ ${r.time} 分钟</span>` +
    (r.kcal?`<span class="tag kcal">🔥 约 ${r.kcal} kcal / 份</span>`:'') +
    (miss.length === 0 ? '<span class="tag ok">✓ 可制作</span>' : `<span class="tag miss">缺 ${miss.length} 样食材</span>`);
  $('#sh-ings').innerHTML = r.ings.map(iid => {
    const ing = ING_OF[iid]; const has = S.picked.includes(iid);
    return `<button class="ing-pill ${has?'ok':'miss'}" data-id="${iid}">${has?'✓':'○'} ${ing.emoji} ${esc(ing.label)}</button>`;
  }).join('');
  const gm = $('#sheet-fill .go-miss');
  if(miss.length && !gm){
    $('#sheet-fill .list-title').insertAdjacentHTML('afterend',
      `<button class="go-miss pressable" data-act="go-miss">🛒 还缺 ${miss.length} 样 · 去补货 →</button>`);
  }else if(!miss.length && gm){ gm.remove(); }
  updateCookBar();
});
function finishCook(){
  const before = bondLv();
  const isNew = !S.cookedIds.includes(cur.id);
  S.cooked++;
  if(isNew) S.cookedIds.push(cur.id);
  save();
  toast(`🎉 「${cur.name}」完成!${isNew ? '新菜谱 +1!' : ''}`);
  say(PRAISE[Math.floor(Math.random()*PRAISE.length)], 4200);
  const after = bondLv();
  renderMe(); refreshMatchUI(); renderRecipes();
  if(after > before){
    setTimeout(() => toast(`🤝 羁绊升级!Lv.${after+1} · ${BONDS[after].name}`), 1200);
  }
  closeSheet();
  checkAchv();
}
function closeSheet(){
  $('#veil').classList.remove('show');
  $('#sheet').classList.remove('show');
  cook.mode = false;
  $('#sheet').classList.remove('cooking');
  unlockScroll();
}
$('#sheet-close').addEventListener('click', closeSheet);
$('#veil').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !$('#badge-pop').classList.contains('show')) closeSheet();
});

/* 缺失食材脉冲高亮 */
function pulseMissing(ids){
  setTimeout(() => {
    ids.forEach((id, i) => {
      const card = $('#ing-grid').querySelector(`[data-id="${id}"]`);
      if(!card) return;
      setTimeout(() => {
        card.classList.add('pulse');
        card.scrollIntoView({block:'center', behavior:'smooth'});
        setTimeout(() => card.classList.remove('pulse'), 1600);
      }, i * 220);
    });
  }, 450);
}

/* 抽屉下滑关闭 */
(function(){
  const sheet = $('#sheet');
  let startY = 0, dy = 0, dragging = false;
  const grab = sheet.querySelector('.grab');
  const head = $('#sh-head');
  [grab, head].forEach(el => el && el.addEventListener('touchstart', e => {
    dragging = true; startY = e.touches[0].clientY; dy = 0;
    sheet.style.transition = 'none';
  }, {passive:true}));
  sheet.addEventListener('touchmove', e => {
    if(!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translate(-50%, ${dy}px)`;
  }, {passive:true});
  sheet.addEventListener('touchend', () => {
    if(!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if(dy > 110) closeSheet();
  });
})();

/* ================= 成就系统 ================= */
const ACHV = [
  {id:'first',  icon:'🥇', name:'初次下厨',     desc:'完成第一道菜',        test:() => S.cooked >= 1},
  {id:'five',   icon:'🍳', name:'小试牛刀',     desc:'累计完成 5 道菜',     test:() => S.cooked >= 5},
  {id:'master', icon:'🔥', name:'灶台达人',     desc:'累计完成 15 道菜',    test:() => S.cooked >= 15},
  {id:'world',  icon:'🌍', name:'环球食客',     desc:'做过 4 种不同菜系',   test:() => cookedCuisines().size >= 4},
  {id:'love',   icon:'❤️', name:'心动收藏',     desc:'收藏 5 道菜',         test:() => S.hearts.length >= 5},
  {id:'fridge', icon:'🧊', name:'冰箱管理大师', desc:'同时选过 15 种食材',  test:() => S.picked.length >= 15},
  {id:'bond',   icon:'🐾', name:'羁绊深厚',     desc:'羁绊达到传奇食伴',    test:() => bondLv() >= 5},
];
let badgeQueue = [];
function checkAchv(){
  ACHV.forEach(a => {
    if(S.achv.includes(a.id)) return;
    let ok = false;
    try{ ok = a.test(); }catch(e){}
    if(ok){ S.achv.push(a.id); badgeQueue.push(a); save(); }
  });
  if(badgeQueue.length) showNextBadge();
}
function showNextBadge(){
  if(!badgeQueue.length) return;
  lockScroll();
  const a = badgeQueue.shift();
  $('#bp-ico').textContent = a.icon;
  $('#bp-t').textContent   = '解锁成就 · ' + a.name;
  $('#bp-d').textContent   = a.desc;
  $('#badge-veil').classList.add('show');
  $('#badge-pop').classList.add('show');
  vib([15,60,15]);
}
$('#bp-ok').addEventListener('click', () => {
  $('#badge-veil').classList.remove('show');
  $('#badge-pop').classList.remove('show');
  if(badgeQueue.length) setTimeout(showNextBadge, 300);
  else { unlockScroll(); renderMe(); }
});

/* ================= 主题色彩 ================= */
const THEMES = [
  {id:'orange', label:'蜜橙',   dot:'#C75D33', hdr:'#C06A3C'},
  {id:'matcha', label:'抹茶',   dot:'#5E8F4C', hdr:'#6FA35A'},
  {id:'berry',  label:'莓果',   dot:'#B4486B', hdr:'#C05C80'},
  {id:'ocean',  label:'海盐蓝', dot:'#3E7CA6', hdr:'#4E88AE'},
  {id:'cocoa',  label:'可可夜', dot:'#8A6A4A', hdr:'#6A4E36'},
];
function applyTheme(id){
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  document.body.dataset.theme = t.id;
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content', t.hdr);
}
function renderThemeRow(){
  $('#theme-row').innerHTML = THEMES.map(t =>
    `<button class="theme-dot ${S.theme===t.id?'on':''}" data-theme="${t.id}" style="background:${t.dot}" title="${t.label}" aria-label="${t.label}"></button>`
  ).join('');
}
$('#theme-row').addEventListener('click', e => {
  const d = e.target.closest('.theme-dot'); if(!d) return;
  S.theme = d.dataset.theme; save();
  renderThemeRow(); applyTheme(S.theme);
  const t = THEMES.find(x => x.id === S.theme);
  toast('🎨 已切换主题:' + t.label);
  vib(12);
});

/* ================= 我的页 ================= */
function renderMe(){
  const days = Math.max(1, Math.ceil((Date.now()-S.first)/86400000));
  $('#st-cooked').textContent = S.cooked;
  $('#st-saved').textContent  = S.hearts.length;
  $('#st-cuisine').textContent= cookedCuisines().size;
  $('#me-name').textContent   = S.name;
  $('#greet-name').textContent= S.name;
  $('#me-loc').textContent    = `📍 ${CITIES[cityIdx]} · 和吉伊相识 ${days} 天`;
  $('#buddy-ds').textContent  = `${S.cooked} 道菜是一起完成的`;

  const lv = bondLv();
  const next = BONDS[Math.min(lv+1, BONDS.length-1)];
  const base = BONDS[lv].at;
  const span = Math.max(1, next.at - base);
  const frac = lv === BONDS.length-1 ? 1 : (S.cooked - base)/span;
  $('#bond-lv').textContent   = `Lv.${lv+1} · ${BONDS[lv].name}`;
  $('#bond-frac').textContent = lv === BONDS.length-1 ? 'MAX' : `${S.cooked-base} / ${span}`;
  $('#bond-fill').style.width = (frac*100).toFixed(0) + '%';
  $('#bond-dots').innerHTML = BONDS.map((_,i) => `<i class="${i <= lv ? 'on':''}"></i>`).join('');

  const favs = RECIPES.filter(r => S.hearts.includes(r.id));
  $('#saved-empty').classList.toggle('show', favs.length === 0);
  $('#saved-list').innerHTML = favs.map(r => {
    const miss = missingOf(r);
    return `
    <button class="saved-item pressable" data-open="${r.id}">
      <span class="ph" style="background:linear-gradient(155deg,${r.bg[0]},${r.bg[1]})">${r.emoji}</span>
      <span class="si-body">
        <span class="si-name" style="color:${r.color}">${esc(r.name)}</span>
        <span class="si-tags">${lvTag(r.level)}<span class="tag time">⏱ ${r.time} 分</span>
        ${miss.length===0?'<span class="tag ok">✓ 可做</span>':`<span class="tag miss">缺 ${miss.length} 样</span>`}</span>
      </span>
      <span class="si-go">›</span>
    </button>`;
  }).join('');

  const grid = $('#achv-grid');
  grid.innerHTML = ACHV.map(a => {
    const on = S.achv.includes(a.id);
    return `<div class="achv ${on?'':'lock'}" title="${a.desc}">
      <span class="a-ico">${a.icon}</span>
      <span class="a-name">${a.name}</span>
      <span class="a-desc">${a.desc}</span>
    </div>`;
  }).join('');
  $('#achv-sub').textContent = `${S.achv.length} / ${ACHV.length}`;
}

/* ================= 撒花 ================= */
function celebrate(){
  const emjs = ['✨','🎉','❤️','⭐','🐾','🥳'];
  const rect = $('#sheet').getBoundingClientRect();
  for(let i = 0; i < 18; i++){
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = emjs[i % emjs.length];
    s.style.left = (rect.left + rect.width/2 + (Math.random()-0.5)*180) + 'px';
    s.style.top  = (rect.top + rect.height*0.4) + 'px';
    s.style.setProperty('--dx', (Math.random()-0.5)*220 + 'px');
    s.style.setProperty('--dy', (-120 - Math.random()*160) + 'px');
    s.style.animationDelay = (Math.random()*0.25) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}

/* ================= 页面切换 & 导航 ================= */
function go(name){
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-'+name));
  $$('.nav-item').forEach(n => n.classList.toggle('on', n.dataset.page === name));
  if(name === 'recipes' && S.picked.length === 0) say('先去选点食材吧,我好帮你挑菜~');
  if(name === 'me') renderMe();
  window.scrollTo({top:0});
}
$$('.nav-item').forEach(n => n.addEventListener('click', () => { vib(8); go(n.dataset.page); }));
$$('[data-page].pill').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));

/* ================= 食谱卡 & 收藏列表事件 ================= */
$('#recipe-grid').addEventListener('click', e => {
  const heart = e.target.closest('.heart');
  if(heart){ e.stopPropagation(); toggleHeart(heart.dataset.id); return; }
  const card = e.target.closest('.recipe'); if(!card) return;
  openSheet(RECIPES.find(x => x.id === card.dataset.id));
});
$('#saved-list').addEventListener('click', e => {
  const m = e.target.closest('.saved-item'); if(!m) return;
  openSheet(RECIPES.find(x => x.id === m.dataset.open));
});

/* ================= 吉伊 台词 ================= */
let lineIdx = 0;
function say(text, keep){
  const b = $('#bubble');
  b.textContent = text || LINES[lineIdx++ % LINES.length];
  b.classList.add('show');
  clearTimeout(say._t);
  say._t = setTimeout(() => b.classList.remove('show'), keep || 3200);
}
/* ================= 吉祥物:点击说话 + 可拖动 ================= */
(function(){
  const m = $('#mascot'), btn = $('#cat');
  let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, lastDragEnd = 0;
  btn.addEventListener('pointerdown', e => {
    if(e.button !== undefined && e.button !== 0) return;
    dragging = true; moved = false;
    const r = m.getBoundingClientRect();
    ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
    try{ btn.setPointerCapture(e.pointerId); }catch(err){}
  });
  btn.addEventListener('pointermove', e => {
    if(!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if(!moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    if(!moved){ moved = true; m.classList.add('dragging'); }
    const w = m.offsetWidth || 84, h = m.offsetHeight || 84;
    const x = Math.min(Math.max(4, ox + dx), window.innerWidth  - w - 4);
    const y = Math.min(Math.max(4, oy + dy), window.innerHeight - h - 4);
    m.style.left = '0'; m.style.top = '0'; m.style.right = 'auto'; m.style.bottom = 'auto';
    m.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  });
  const endDrag = () => {
    if(dragging && moved){ lastDragEnd = Date.now(); m.classList.remove('dragging'); }
    dragging = false;
  };
  btn.addEventListener('pointerup', endDrag);
  btn.addEventListener('pointercancel', endDrag);
  btn.addEventListener('click', () => {
    if(Date.now() - lastDragEnd < 250) return;
    vib(8); say();
  });
})();

/* ================= 头部按钮 ================= */
let cityIdx = Math.max(0, CITIES.indexOf('香港'));
$('#city-btn').addEventListener('click', () => {
  cityIdx = (cityIdx+1) % CITIES.length;
  $('#city-btn').textContent = '📍 · ' + CITIES[cityIdx];
  vib(8); renderMe();
});
$('#edit-name').addEventListener('click', () => {
  const name = (prompt('给自己起个名字吧(最多 8 个字):', S.name) || '').trim().slice(0,8);
  if(name){ S.name = name; save(); renderMe(); toast('你好呀,' + name + '!'); }
});
$('#buddy-go').addEventListener('click', () => { go('match'); say('看看冰箱里有什么,选给我吧~'); });
$('#buddy-change').addEventListener('click', () => toast('🎀 小八:我可是唯一的!'));
$('#reset-btn').addEventListener('click', () => {
  if(!confirm('确定要重置全部进度吗?\n(做过、收藏、成就都会清空)')) return;
  if(!confirm('真的要和 吉伊 重新认识吗?🐾')) return;
  localStorage.removeItem(KEY);
  location.reload();
});

/* ================= 状态栏时钟 ================= */
function tick(){
  const d = new Date();
  $('#clock').textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
tick(); setInterval(tick, 15000);

/* ================= 问候语 ================= */
function greet(){
  const h = new Date().getHours();
  let t = '今天想和 吉伊 做点什么?';
  if(h < 5)       t = '夜深了,想吃点热乎的?';
  else if(h < 11) t = '早上好,元气早餐想吃什么?';
  else if(h < 14) t = '中午好,午饭解决了吗?';
  else if(h < 18) t = '下午好,要不要来点下午茶?';
  else            t = '晚上好,今天的晚餐想好没?';
  $('#greet-sub').textContent = t;
}

/* ================= 地址栏定位 ================= */
function fromHash(){
  const h = location.hash.replace('#','');
  if(['recipes','match','community','me'].includes(h)) go(h);
}
window.addEventListener('hashchange', fromHash);

/* ================= 启动 ================= */
applyTheme(S.theme || 'orange'); renderThemeRow();
renderChipsMatch(); renderIngs();
renderDaily(); renderRecipes(); syncQfUI();
renderMe(); refreshMatchUI();
greet(); fromHash();
setTimeout(() => say(`嗨,我是 吉伊 🎀 ${RECIPES.length} 道菜随你挑!`, 3600), 800);
