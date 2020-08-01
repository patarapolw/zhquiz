---
data:
  dict: sentence
  match: {{{json entry}}}
---

#### Sentence Chinese-English

<h2 class="font-zh-simp text-w-normal"> {{entry}} </h2>

<!-- separator -->

<div>
  <h2 class="font-zh-simp text-w-normal inline-block"> {{entry}} </h2>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>

<ul>
  {{#each data.reading}}
  <li> {{this}} </li>
  {{/each}}
</ul>

<ul>
  {{#each data.english}}
  <li> {{this}} </li>
  {{/each}}
</ul>
