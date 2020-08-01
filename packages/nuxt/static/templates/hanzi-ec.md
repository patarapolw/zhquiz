---
data:
  dict: hanzi
  match: {{{json entry}}}
---

#### Hanzi English-Chinese

<ul>
  {{#each data.english}}
  <li>{{mask this ../entry}}</li>
  {{/each}}
</ul>

<!-- separator -->

<div>
  <span class="hanzi-display font-han inline-block"> {{entry}} </span>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>

<div>
  {{join data.reading ' | '}}
</div>
