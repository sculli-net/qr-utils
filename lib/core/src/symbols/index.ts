import type { SymbolType } from '../types.js'
import type { SymbolDefinition } from './definition.js'
import { micro } from './micro.js'
import { model1 } from './model1.js'
import { model2 } from './model2.js'
import { rmqr } from './rmqr.js'

export const SYMBOLS: Readonly<Record<SymbolType, SymbolDefinition>> = { model2, model1, micro, rmqr }
