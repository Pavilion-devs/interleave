# Third-party notices

## Interface fonts

Interleave self-hosts the Latin subsets of
[Manrope](https://github.com/sharanda/manrope) and
[Geist Mono](https://github.com/vercel/geist-font). Both font families are
distributed under the SIL Open Font License 1.1. The font files are stored in
`app/fonts` so production builds do not depend on an external font request.

## TodoMVC React reducer

Interleave's TodoMVC integration adapts the reducer behavior from
[`tastejs/todomvc/examples/react/src/todo/reducer.js`](https://github.com/tastejs/todomvc/blob/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/react/src/todo/reducer.js),
pinned at commit `ff43b02e59dfa604386bb382034b2cd07c2bcd8a` on 2026-09-03. The integration fault demonstrated by Interleave is
seeded in Interleave's delayed orchestration layer and is not an upstream
TodoMVC defect.

Everything in the TodoMVC repository is MIT licensed unless otherwise stated.

Copyright (c) Addy Osmani, Sindre Sorhus, Pascal Hartig, Stephen Sawchuk.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The upstream reducer also embeds the Nano ID 3.0.2 non-secure routine under the
MIT license, copyright 2017 Andrey Sitnik.

## Plane public source

Interleave's Plane integration models the issue-link update and metadata worker
behavior documented in [makeplane/plane#9674](https://github.com/makeplane/plane/issues/9674).
The source review and proposed patch are pinned to Plane commit
[`da1a7ab85012d16836459a10dd92ec55eb739c69`](https://github.com/makeplane/plane/commit/da1a7ab85012d16836459a10dd92ec55eb739c69).
Interleave does not bundle or execute a Plane deployment; the downloadable patch
is a local review artifact for the public upstream source.

`public/plane-9674.patch` modifies Plane files and is distributed as a
derivative Plane artifact under AGPL-3.0. See
[`docs/PLANE-PATCH-LICENSE.md`](docs/PLANE-PATCH-LICENSE.md) for the explicit
license boundary. Interleave's original source remains MIT licensed.

Plane is licensed under the GNU Affero General Public License v3.0. The upstream
license and notices remain available in the
[`makeplane/plane` repository](https://github.com/makeplane/plane/blob/da1a7ab85012d16836459a10dd92ec55eb739c69/LICENSE).
