(function(){
  /**
   * Main extraction dispatcher. Routes items to file, URL, or YouTube extractors.
   * For file items, attempts to load the saved blob from IndexedDB when missing.
   * @param {{id:string,kind:'file'|'url'|'youtube',file?:File,fileName?:string,fileType?:string,title?:string,url?:string}} item
   * @returns {Promise<{title:string,text:string,[k:string]:any}>}
   */
  async function extract(item){
    if (item.kind === 'file') {
      let file = item.file;
      if (!file) {
        const saved = await DV.db.get('contents', item.id + ':file');
        if (saved?.blob) {
          try { file = new File([saved.blob], saved.name || item.fileName || 'file', { type: saved.type || item.fileType || '' }); }
          catch { file = saved.blob; }
        }
      }
      if (!file) throw new Error('Missing file blob');
      const res = await DV.extractors.extractFile(file);
      return { ...res, title: item.title || res.title };
    }
    if (item.kind === 'url') return await DV.extractors.extractUrl(item);
    if (item.kind === 'youtube') return await DV.extractors.extractYouTube(item);
    throw new Error('Unknown item kind: ' + item.kind);
  }

  window.DV = window.DV || {};
  DV.extractors = DV.extractors || {};
  DV.extractors.extract = extract;
})();