import { beforeEach } from 'vitest';

beforeEach(() => {
  // 各テスト前にDOMをクリア
  document.body.innerHTML = '';
  
  // SVG namespace を設定
  if (typeof document.createElementNS === 'undefined') {
    global.document.createElementNS = (namespace, tag) => {
      const element = document.createElement(tag);
      element.namespaceURI = namespace;
      return element;
    };
  }
});