import test from 'ava'
import fn from '../index.js'

test('main', t => {
   t.is(fn('foo'), fn('foobar'))
})
