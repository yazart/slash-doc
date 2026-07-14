export default class CustomToolTool {
  static get toolbox() {
    return {
      title: 'customTool',
      icon: '<svg width="17" height="15" viewBox="0 0 17 15" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 0L10.4 5.7H16.4L11.5 9.2L13.4 14.9L8.5 11.4L3.6 14.9L5.5 9.2L0.6 5.7H6.6L8.5 0Z"/></svg>'
    };
  }

  constructor({ data }) {
    this.data = data || {};
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'true';
    wrapper.textContent = this.data.text || 'customTool';
    return wrapper;
  }

  save(blockContent) {
    return {
      text: blockContent.textContent || ''
    };
  }
}

export function toHtml(data) {
  return '<div>' + escapeHtml(data.text || '') + '</div>';
}

export function toMarkdown(data) {
  return data.text || '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
