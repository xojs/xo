import test from 'ava'
import fn from '..'

test(t => {
    t.is(fn('foo'), fn('foobar'))
})
