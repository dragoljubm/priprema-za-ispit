(() => {
  'use strict';
  window.createStudyNavigation = ({onNavigate,onBack}) => {
    const browserHistory = window.history;
    const path = window.location.pathname;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const rootDepth = standalone ? 1 : 0;
    let depth = 0;
    let current = {route:'home',scrollY:0};
    let pendingRoot = null;
    const owns = state => state?.studyNavigation === 1 && state.path === path && Number.isSafeInteger(state.depth) && state.depth >= 0;
    const pack = (state,index) => ({...state,studyNavigation:1,path,depth:index,guard:standalone});
    const push = state => { depth++; browserHistory.pushState(pack(state,depth),''); };
    const saveScroll = () => {
      current = {...current,scrollY:window.scrollY || 0};
      browserHistory.replaceState(pack(current,depth),'');
    };
    function start(state) {
      current = state;
      const existing = browserHistory.state;
      if (owns(existing) && existing.guard === standalone && existing.depth >= rootDepth) {
        depth = existing.depth;
        browserHistory.replaceState(pack(current,depth),'');
      } else {
        depth = 0;
        browserHistory.replaceState(pack(current,depth),'');
        if (standalone) push(current);
      }
      browserHistory.scrollRestoration = 'manual';
    }
    function navigate(state,{replace=false,root=false}={}) {
      if (pendingRoot) return;
      saveScroll();
      if (root && depth > rootDepth) {
        pendingRoot = state;
        browserHistory.go(rootDepth-depth);
        return;
      }
      const same = current.route === state.route && current.detailSessionId === state.detailSessionId;
      const tabs = ['history','settings'];
      if (replace || root || same || (tabs.includes(current.route) && tabs.includes(state.route))) {
        browserHistory.replaceState(pack(state,depth),'');
      } else push(state);
      current = state;
      onNavigate(state);
    }
    function back() {
      if (pendingRoot || onBack?.(current)) return;
      saveScroll();
      if (depth > rootDepth) browserHistory.back();
      else if (current.route !== 'home') navigate({route:'home',scrollY:0},{replace:true});
      else if (!standalone) browserHistory.back();
    }
    window.addEventListener('popstate',event => {
      const target = owns(event.state) ? event.state : {route:'home',depth:0,scrollY:0};
      if (pendingRoot) {
        depth = target.depth;
        current = pendingRoot;
        pendingRoot = null;
        browserHistory.replaceState(pack(current,depth),'');
        onNavigate(current);
        return;
      }
      if ((standalone && current.route === 'home') || onBack?.(current)) {
        depth = target.depth;
        push(current);
        return;
      }
      depth = target.depth;
      current = target;
      onNavigate(target);
    });
    return {start,navigate,back};
  };
})();
