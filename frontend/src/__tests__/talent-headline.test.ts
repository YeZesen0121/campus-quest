import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyTalentForm, talentFormToFields, validateTalentForm } from '../features/innovation/talentForm';

test('the card sentence is required even when saving an incomplete private draft',()=>{
  for(const headline of ['', ' \n\t ']){
    assert.ok(validateTalentForm({...emptyTalentForm(), headline},'save').headline);
  }
  assert.deepEqual(validateTalentForm({...emptyTalentForm(),headline:'想尝试校园产品实践'},'save'),{});
});

test('a card sentence counts Unicode codepoints and trims before saving',()=>{
  for(const character of ['字','a','🌱']){
    const form={...emptyTalentForm(),headline:` ${character.repeat(40)} `};
    assert.equal(validateTalentForm(form,'save').headline,undefined);
    assert.equal((talentFormToFields(form) as Record<string,unknown>).headline,character.repeat(40));
    assert.ok(validateTalentForm({...form,headline:character.repeat(41)},'save').headline);
  }
});
