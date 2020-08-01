---
data:
  dict: extra
  match: {{{json entry}}}
---

#### Extra Chinese-English

<h2 class="font-zh-simp text-w-normal"> {{entry}} </h2>

<!-- separator -->

<div>
  <span class="inline-block mr-4"> {{data.reading}} </span>
  <x-speak-button class="speak-item--1"> {{entry}} </x-speak-button>
</div>

<div>
  {{data.english}}
</div>
