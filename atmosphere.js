(() => {
  'use strict';
  const layer = document.createElement('div');
  layer.className = 'app-stardust';
  layer.setAttribute('aria-hidden','true');
  document.body.append(layer);
  const motes = [];
  const star = '<svg viewBox="0 0 24 24"><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/></svg>';
  const heart = '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
  for (let i=0;i<14;i++) {
    const node = document.createElement('span');
    node.className = `ambient-mote${i%3===0 ? ' is-heart' : ''}`;
    node.innerHTML = i%3===0 ? heart : star;
    node.style.setProperty('--mote-size',`${5+Math.random()*5}px`);
    node.style.setProperty('--mote-time',`${9+Math.random()*8}s`);
    node.style.setProperty('--mote-delay',`${-Math.random()*15}s`);
    node.style.setProperty('--mote-alpha',String(.18+Math.random()*.16));
    layer.append(node);motes.push(node);
  }
  let frame,needsPlacement=true;
  function arrange() {
    frame = null;
    const width=window.innerWidth,height=window.innerHeight;
    const blocked=[...document.querySelectorAll('button,input,select,textarea,a,summary,h1,h2,h3,p,label,.review-row,.review-option,.question-number,.counter-pill,.stat,.brand,.brand-subtitle,.accuracy-value')]
      .map(node=>node.getBoundingClientRect()).filter(rect=>rect.width && rect.height && rect.bottom>0 && rect.top<height);
    if(!needsPlacement) {
      motes.forEach((node,index)=>{
        const x=parseFloat(node.style.left),y=parseFloat(node.style.top);
        node.dataset.covered=String((width<600 && index>=10)||!Number.isFinite(x)||blocked.some(rect=>x>rect.left-18 && x<rect.right+12 && y>rect.top-15 && y<rect.bottom+28));
      });return;
    }
    needsPlacement=false;
    motes.forEach((node,index)=>{
      if(width<600 && index>=10){node.dataset.covered='true';return;}
      let placed=false;
      for(let attempt=0;attempt<30;attempt++) {
        const x=12+Math.random()*Math.max(1,width-34);
        const y=75+Math.random()*Math.max(1,height-180);
        if(blocked.some(rect=>x>rect.left-18 && x<rect.right+12 && y>rect.top-15 && y<rect.bottom+28))continue;
        node.style.left=`${x}px`;node.style.top=`${y}px`;placed=true;break;
      }
      node.dataset.covered=String(!placed);
    });
  }
  function queue(reposition=true){needsPlacement=needsPlacement||reposition;if(frame == null)frame=requestAnimationFrame(arrange);}
  new MutationObserver(()=>queue()).observe(document.getElementById('app')||document.body,{childList:true});
  window.addEventListener('resize',()=>queue());
  window.addEventListener('scroll',()=>queue(false),{passive:true});
  document.addEventListener('visibilitychange',()=>{layer.style.display=document.hidden?'none':'';if(!document.hidden)queue();});
  queue();
})();
