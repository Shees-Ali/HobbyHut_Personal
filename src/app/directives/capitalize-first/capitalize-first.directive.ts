import { Directive, HostListener, ElementRef } from '@angular/core';

@Directive({
  selector: '[capitalizeFirst]'
})
export class CapitalizeFirstDirective {

  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event']) onInputChange(event: Event): void {
    const input = this.el.nativeElement.value;
    this.el.nativeElement.value = this.capitalizeWords(input);
  }

  private capitalizeWords(value: string): string {
    if (!value) return '';
    return value.toLowerCase().replace(/\b\w/g, first => first.toUpperCase());
  }
}
