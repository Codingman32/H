(function(){
"use strict";
const rng = (seed = Date.now()) => {
  let s = seed >>> 0;
  return function(){
    s = Math.imul(48271, s) | 0;
    s ^= s >>> 13;
    s = (s + 0x7fffffff) | 0;
    return (s >>> 0) / 4294967296;
  };
};
const rnd = rng(+(new Date()) ^ 0x9E3779B9);
const range = (n) => Array.from({length: n}, (_, i) => i);
const pick = (arr) => arr[Math.floor(rnd()*arr.length)];
const weightedPick = (arr, weights) => {
  const sum = weights.reduce((a,b)=>a+b,0);
  let x = rnd()*sum;
  for(let i=0;i<arr.length;i++){
    x -= weights[i];
    if(x<=0) return arr[i];
  }
  return arr[arr.length-1];
};
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const shuffle = (a) => {
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rnd()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
};

function id(n){ return n.toString(36) + '-' + Math.floor(rnd()*1e9).toString(36); }

function makeGrid(w,h,fill=null){
  const g = new Array(h);
  for(let y=0;y<h;y++){
    g[y]=new Array(w);
    for(let x=0;x<w;x++) g[y][x]= (typeof fill === 'function') ? fill(x,y) : fill;
  }
  return g;
}

function mirror(grid){
  const h = grid.length;
  const w = grid[0].length;
  const out = makeGrid(w,h);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      out[y][x]=grid[y][x];
      if(x < w/2) out[y][w-1-x]=grid[y][x];
    }
  }
  return out;
}

function mapGrid(grid, fn){
  const h = grid.length;
  const w = grid[0].length;
  const out = makeGrid(w,h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) out[y][x]=fn(grid[y][x],x,y);
  return out;
}

function convolve(grid, kernel){
  const h = grid.length;
  const w = grid[0].length;
  const kh = kernel.length;
  const kw = kernel[0].length;
  const ox = Math.floor(kw/2);
  const oy = Math.floor(kh/2);
  const out = makeGrid(w,h,0);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let s=0;
      for(let ky=0;ky<kh;ky++) for(let kx=0;kx<kw;kx++){
        const gx = x + kx - ox;
        const gy = y + ky - oy;
        if(gx>=0 && gy>=0 && gx<w && gy<h) s += grid[gy][gx]*kernel[ky][kx];
      }
      out[y][x]=s;
    }
  }
  return out;
}

function perlinNoise(w,h,opts={}){
  const freq = opts.freq || 6;
  const amp = opts.amp || 1;
  const grid = makeGrid(w,h,0);
  const nx = freq, ny = freq;
  const grad = {};
  const g = (i,j) => {
    const k = `${i},${j}`;
    if(grad[k]) return grad[k];
    const a = rnd()*Math.PI*2;
    grad[k]=[Math.cos(a),Math.sin(a)];
    return grad[k];
  };
  const fade = t => t*t*t*(t*(t*6-15)+10);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const fx = x/w*nx;
    const fy = y/h*ny;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = x0+1, y1 = y0+1;
    const sx = fade(fx-x0), sy = fade(fy-y0);
    const dot = (ix,iy,px,py)=>{
      const gvec = g(ix,iy);
      const dx = px-ix, dy = py-iy;
      return gvec[0]*dx + gvec[1]*dy;
    };
    const n0 = dot(x0,y0,fx,fy);
    const n1 = dot(x1,y0,fx,fy);
    const ix0 = n0 + (n1-n0)*sx;
    const n2 = dot(x0,y1,fx,fy);
    const n3 = dot(x1,y1,fx,fy);
    const ix1 = n2 + (n3-n2)*sx;
    const v = ix0 + (ix1-ix0)*sy;
    grid[y][x] = (v*amp+1)/2;
  }
  return grid;
}

function flowField(w,h,scale){
  const n = perlinNoise(w, h, {freq: scale, amp: 1});
  const out = makeGrid(w,h,[0,0]);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const a = n[y][x]*Math.PI*2;
    out[y][x] = [Math.cos(a), Math.sin(a)];
  }
  return out;
}

function particleSystem(w,h,count,field){
  const particles = [];
  for(let i=0;i<count;i++){
    particles.push({
      id: id(i),
      x: rnd()*w,
      y: rnd()*h,
      vx: (rnd()-0.5)*2,
      vy: (rnd()-0.5)*2,
      life: Math.floor(30 + rnd()*600),
      col: [Math.floor(rnd()*255),Math.floor(rnd()*255),Math.floor(rnd()*255)],
      size: 0.5 + rnd()*3
    });
  }
  const steps = [];
  for(let t=0;t<120;t++){
    const snap = particles.map(p=>({x:p.x,y:p.y,size:p.size,col:p.col.slice()}));
    steps.push(snap);
    for(let p of particles){
      if(Math.random() < 0.002){ p.vx += (rnd()-0.5)*4; p.vy += (rnd()-0.5)*4; }
      const fx = Math.floor(clamp(Math.floor(p.x),0,field[0].length-1));
      const fy = Math.floor(clamp(Math.floor(p.y),0,field.length-1));
      const f = field[fy] && field[fy][fx] ? field[fy][fx] : [0,0];
      p.vx += f[0]*0.5;
      p.vy += f[1]*0.5;
      p.x += p.vx*0.5;
      p.y += p.vy*0.5;
      p.vx *= 0.98; p.vy *= 0.98;
      p.life--;
      if(p.x<0) p.x = w + (p.x%w);
      if(p.y<0) p.y = h + (p.y%h);
      if(p.x>=w) p.x = p.x%w;
      if(p.y>=h) p.y = p.y%h;
      if(p.life <= 0){
        p.x = rnd()*w; p.y = rnd()*h; p.life = Math.floor(30 + rnd()*600);
        p.vx = (rnd()-0.5)*2; p.vy = (rnd()-0.5)*2;
        p.col = [Math.floor(rnd()*255),Math.floor(rnd()*255),Math.floor(rnd()*255)];
        p.size = 0.5 + rnd()*3;
      }
    }
  }
  return steps;
}

function cellularAutomaton(w,h,iter,ruleSeed){
  const a = makeGrid(w,h,0);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    a[y][x] = rnd() < 0.45 ? 1 : 0;
  }
  const rule = (() => {
    const r = {};
    const keys = range(512).map(i => i.toString(2).padStart(9,'0'));
    for(let k of keys) r[k] = (rnd()>.5)?1:0;
    return r;
  })();
  const out = [];
  for(let t=0;t<iter;t++){
    out.push(a.map(row => row.slice()));
    const b = makeGrid(w,h,0);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      let key = '';
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const nx = (x+dx+w)%w, ny = (y+dy+h)%h;
        key += a[ny][nx] ? '1' : '0';
      }
      b[y][x] = rule[key];
    }
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) a[y][x]=b[y][x];
  }
  return out;
}

function lsystem(iter,axiom,rules,angle,step){
  let s = axiom;
  for(let i=0;i<iter;i++){
    let ns = '';
    for(let ch of s){
      ns += (rules[ch] !== undefined) ? rules[ch] : ch;
    }
    s = ns;
  }
  const rad = a => a*Math.PI/180;
  let x=0,y=0,dir=0;
  const path = [[x,y]];
  for(let ch of s){
    if(ch === 'F' || ch === 'G'){
      x += Math.cos(dir)*step;
      y += Math.sin(dir)*step;
      path.push([x,y]);
    } else if(ch === '+') dir += rad(angle);
    else if(ch === '-') dir -= rad(angle);
    else if(ch === '['){ path.push(null); path.push(['P',x,y,dir]); }
    else if(ch === ']'){
      while(path.length){
        const p = path.pop();
        if(p && p[0] === 'P'){
          x = p[1]; y = p[2]; dir = p[3];
          path.push([x,y]);
          break;
        }
      }
    }
  }
  return path.filter(p=>p !== null);
}

function textEntropy(s){
  const freq = {};
  for(let ch of s) freq[ch] = (freq[ch]||0)+1;
  const n = s.length;
  let H = 0;
  for(let k in freq){
    const p = freq[k]/n;
    H -= p*Math.log2(p);
  }
  return H;
}

function hashStr(s){
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h>>>0).toString(16);
}

function buildPalette(n){
  const pal = [];
  for(let i=0;i<n;i++){
    const h = Math.floor(rnd()*360);
    const s = Math.floor(40 + rnd()*60);
    const l = Math.floor(20 + rnd()*60);
    pal.push(`hsl(${h} ${s}% ${l}%)`);
    
