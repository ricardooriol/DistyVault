// Extractor router
(function(){
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