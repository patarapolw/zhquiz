---
data:
  dict: vocab
  match: {{{json entry}}}
sentences:
  dict: sentence
  q: {{{json entry}}}
---

#### Vocab Simplified-English

<div class="font-zh-simp text-w-normal" style="font-size: 2rem;">
  {{entry}}
</div>

<!-- separator -->

{{#if data.alt}}
<div>
  <span class="font-zh-trad text-w-normal inline-block mr-4" style="font-size: 1.7rem;">
    {{join data.alt ' | '}}
  </span>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>
{{/if}}

<div>
  <span class="inline-block mr-4"> {{join data.reading ' | '}} </span>
  {{#unless data.alt.length}}
    <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
  {{/unless}}
</div>

{{#if data.english}}
<ul>
  {{#each data.english}}
  <li> {{this}} </li>
  {{/each}}
</ul>
{{/if}}

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
