---
data:
  dict: vocab
  match: {{{json entry}}}
sentences:
  dict: sentence
  q: {{{json entry}}}
---

#### Vocab Traditional-English

<div class="font-zh-trad text-w-normal" style="font-size: 1.7rem;">
  {{join data.alt ' | '}}
</div>

<!-- separator -->

<div>
  <span class="font-zh-simp text-w-normal inline-block mr-4" style="font-size: 2rem;">
    {{entry}}
  </span>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>

<div>
  {{join data.reading ' | '}}
</div>

<ul>
  {{#each data.english}}
  <li> {{this}} </li>
  {{/each}}
</ul>

{{#if sentences.length}}
<ul>
  {{#each sentences}}
  <li>
    <span class="font-zh-simp"> {{entry}} </span>
    <x-speak-button class="speak-item-{{@index}}"> {{entry}} </x-speak-button>
    <ul>
      {{#each english}}
      <li> {{this}} </li>
      {{/each}}
    </ul>
  </li>
  {{/each}}
</ul>
{{/if}}
