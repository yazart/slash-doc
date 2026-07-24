export const FILE_PROCESSOR_TEMPLATE = `
  <div class="fp-shell">
    <div class="fp-head">
      <span class="fp-title">Обработчик CSV / JSON</span>
      <span class="fp-status"></span>
    </div>
    <div class="fp-body">
      <div class="fp-drop" tabindex="0">
        <span>
          Перетащите CSV/JSON файлы или
          <button class="fp-button secondary fp-select" type="button">выберите</button>
        </span>
        <input
          class="fp-input"
          type="file"
          accept=".csv,.json,text/csv,application/json"
          multiple
          hidden
        >
      </div>
      <section class="fp-section">
        <span class="fp-label">Файлы страницы</span>
        <div class="fp-files fp-input-files"></div>
      </section>
      <section class="fp-section">
        <span class="fp-label">JavaScript</span>
        <div class="fp-editor">
          <pre class="fp-highlight" aria-hidden="true"></pre>
          <textarea
            class="fp-script"
            spellcheck="false"
            wrap="off"
            aria-label="JavaScript обработки файлов"
          ></textarea>
        </div>
      </section>
      <div class="fp-actions">
        <button class="fp-button fp-run" type="button">Выполнить</button>
        <span class="fp-status-text fp-empty">Доступны Node.js API, csv и csv/sync</span>
      </div>
      <section class="fp-section">
        <span class="fp-label">Результаты</span>
        <div class="fp-files fp-results"></div>
      </section>
      <section class="fp-section">
        <span class="fp-label">Вывод</span>
        <pre class="fp-console"></pre>
      </section>
    </div>
  </div>
`;
