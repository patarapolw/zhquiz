---
data:
  dict: sentence
  match: {{{json entry}}}
---

#### Sentence English-Chinese

<ul>
  {{#each data.english}}
  <li> {{this}} </li>
  {{/each}}
</ul>

<!-- separator -->

<div>
  <span class="font-zh-simp"> {{entry}} </span>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>

<ul>
  {{#each data.reading}}
  <li> {{this}} </li>
  {{/each}}
</ul>
