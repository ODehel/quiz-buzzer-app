import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';

import { StatusBadgeComponent } from './status-badge.component';
import type { GameStatus } from '../../core/models/websocket.models';

@Component({
  standalone: true,
  imports: [StatusBadgeComponent],
  template: '<app-status-badge [status]="status" />',
})
class TestHostComponent {
  status: GameStatus = 'PENDING';
}

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders "En attente" with amber class for PENDING status', () => {
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('En attente');
    expect(badge.classList).toContain('badge--amber');
  });

  it('renders "En cours" with blue class for OPEN status', () => {
    host.status = 'OPEN';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('En cours');
    expect(badge.classList).toContain('badge--blue');
  });

  it('renders "En cours" with blue class for QUESTION_TITLE status', () => {
    host.status = 'QUESTION_TITLE';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('En cours');
    expect(badge.classList).toContain('badge--blue');
  });

  it('renders "En cours" with blue class for QUESTION_OPEN status', () => {
    host.status = 'QUESTION_OPEN';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('En cours');
    expect(badge.classList).toContain('badge--blue');
  });

  it('renders "En cours" with blue class for QUESTION_BUZZED status', () => {
    host.status = 'QUESTION_BUZZED';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('En cours');
    expect(badge.classList).toContain('badge--blue');
  });

  it('renders "En cours" with blue class for QUESTION_CLOSED status', () => {
    host.status = 'QUESTION_CLOSED';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('En cours');
    expect(badge.classList).toContain('badge--blue');
  });

  it('renders "Terminée" with green class for COMPLETED status', () => {
    host.status = 'COMPLETED';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('Terminée');
    expect(badge.classList).toContain('badge--green');
  });

  it('renders "Erreur" with red class for IN_ERROR status', () => {
    host.status = 'IN_ERROR';
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.textContent.trim()).toBe('Erreur');
    expect(badge.classList).toContain('badge--red');
  });
});
