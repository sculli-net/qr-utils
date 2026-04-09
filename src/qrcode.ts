import Utils from './utils'
const { getSymbolTotalCodewords, getSymbolSize, setToSJISFunction } = Utils;

import EXLevel from './error-correction-level'
const { from: retrieveEXLevel, L, M, Q, H } = EXLevel;
const levels = {
    low: L,
    medium: M,
    quartile: Q,
    high: H
};
const { low, medium, quartile, high } = levels;

import BitBuffer from './bit-buffer'

import BitMatrix from './bit-matrix'

import AlignmentPattern from'./alignment-pattern'
const { getPositions: getAlignmentPositions } = AlignmentPattern;

import FinderPattern from'./finder-pattern'
const { getPositions: getFinderPositions } = FinderPattern;

import MaskPattern from './mask-pattern'
const { getBestMask, applyMask, from: retrieveMask } = MaskPattern;

import ECCode from './error-correction-code'
const { getTotalCodewordsCount, getBlocksCount } = ECCode;

import ReedSolomonEncoder from './reed-solomon-encoder'

import Version from './version'
const { getEncodedBits: getEncodedVersionBits, getBestVersionForData, from: retrieveVersion } = Version;


import FormatInfo from './format-info'
const { getEncodedBits: getEncodedFormatBits } = FormatInfo;


import Mode from './mode'
const { getCharCountIndicator } = Mode;


import Segments from './segments'
const { fromArray, rawSplit, fromString } = Segments;




