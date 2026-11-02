import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'titleCase',
})
export class TitleCaseWordsPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) {
      return '';
    }

    const minorWords = new Set(['a', 'an', 'and', 'at', 'but', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'while', 'with', 'yet']);
    const words = value.toLowerCase().split(/\s+/);

    return words
      .map((word, index) => {
        if (!word) {
          return word;
        }

        const isFirstOrLast = index === 0 || index === words.length - 1;
        if (minorWords.has(word) && !isFirstOrLast) {
          return word;
        }

        const segments = word.split('/');
        return segments.map(s => s.charAt(0).toUpperCase() + s.substring(1)).join('/');
      })
      .join(' ');
  }
}