# Third-party notices

Slash Doc включает стороннее программное обеспечение. Собственный код проекта лицензируется отдельно по MIT; перечисленные компоненты продолжают распространяться на условиях своих лицензий.

## Прямые runtime-зависимости

| Компонент                                                      | Используемая лицензия                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| Editor.js                                                      | Apache-2.0                                                     |
| Editor.js Header, Image, Inline Code, List, Marker и Underline | MIT                                                            |
| Shoelace                                                       | MIT                                                            |
| bpmn-js 9.0.0                                                  | MIT-подобная лицензия с обязательным видимым watermark bpmn.io |
| csv                                                            | MIT                                                            |
| Express                                                        | MIT                                                            |
| highlight.js                                                   | BSD-3-Clause                                                   |
| Lit                                                            | BSD-3-Clause                                                   |
| Lucide Icons                                                   | ISC; отдельные Feather-derived иконки — MIT                    |
| Mermaid                                                        | MIT                                                            |
| Puppeteer                                                      | Apache-2.0                                                     |

## Транзитивные зависимости

По данным установленного `package-lock.json` runtime-дерево использует лицензии MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense и `(MPL-2.0 OR Apache-2.0)`. Для компонента с двойной лицензией используется вариант Apache-2.0.

У старых транзитивных пакетов [`component-event 0.1.4`](https://github.com/component/event) и [`indexof 0.0.1`](https://github.com/component/indexof) поле лицензии отсутствует в опубликованном npm-архиве; их исходные репозитории помечают соответствующий код лицензией MIT. Пакет `khroma 2.1.0` также не заполняет поле `license`, но содержит полный текст MIT в файле `license`.

Полный перечень пакетов и точных версий зафиксирован в `package-lock.json`. Тексты лицензий и copyright-уведомления находятся в соответствующих пакетах npm и должны сохраняться при повторном распространении этих компонентов.

## Lucide Icons

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

Часть используемых Lucide-иконок происходит из Feather Icons:

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Особое условие bpmn-js 9.0.0

Лицензия bpmn-js разрешает использование, изменение и распространение библиотеки при сохранении её copyright-уведомления и текста лицензии. Дополнительно исходный код, отвечающий за watermark bpmn.io, нельзя удалять или изменять; watermark должен оставаться полностью видимым и не должен перекрываться элементами интерфейса.
