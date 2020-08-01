---
data:
  dict: vocab
  match: {{{json entry}}}
sentences:
  dict: sentence
  q: {{{json entry}}}
---

#### Vocab English-Chinese

<ul>
  {{#each data.english}}
  <li> {{mask this ../entry ../data.reading ../data.alt}} </li>
  {{/each}} 
</ul> 

<!-- separator -->

<div>
  <span class="font-zh-simp text-w-normal inline-block mr-4" style="font-size: 2rem;">
    {{entry}}
  </span>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>

{{#if data.alt}}
<div class="font-zh-trad text-w-normal" style="font-size: 1.7rem;">
  {{join data.alt ' | '}}
</div>
{{/if}}

{{#if data.reading}}
<div>
  {{join data.reading ' | '}}
</div>
{{/if}}

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
      <li> {{english}} </li>
    </ul>
  </li>
  {{/each}}
</ul>
{{/if}}
