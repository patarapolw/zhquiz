---
data:
  dict: hanzi
  match: {{{json entry}}}
---

#### Hanzi Chinese-English

<div class="font-han text-w-normal" style="font-size: 3rem;">
  {{entry}}
</div>

<!-- separator -->

<div>
  <span class="inline-block mr-4"> {{join data.reading ' | '}} </span>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>

<ul>
  {{#each data.english}}
  <li> {{this}} </li>
  {{/each}}
</ul>
