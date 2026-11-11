'use strict';

function fitIcon(key, index) {
  const shoulders = [25, 28, 32, 37][index];
  const torso = [20, 18, 15, 12][index];
  const lean = [0, 4, 8][index];
  const shapes = {
    shoulders: `<circle cx="36" cy="14" r="9"/><path d="M30 22h12v5L59 ${shoulders} 67 60H5L13 ${shoulders} 30 27Z"/>`,
    chest: `<circle cx="36" cy="14" r="9"/><path d="M31 23h10l${23 - torso} 5 ${torso} 8-6 22H14L8 36l${torso}-8z"/><path d="M18 39q17 12 36 0m-18-11v23" fill="none" stroke="#323e4b" stroke-width="2"/>`,
    posture: `<circle cx="${36 + lean}" cy="13" r="9"/><path d="M${32 + lean} 22q-13 13-10 38h24q-7-18 ${lean + 4}-29l-5-9z"/><path d="M${29 + lean} 26q-10 12-9 33" fill="none" stroke="#f1f5f8" stroke-dasharray="2 3"/>`,
  };
  return `<svg aria-hidden="true" viewBox="0 0 72 66" fill="currentColor">${shapes[key]}</svg>`;
}
