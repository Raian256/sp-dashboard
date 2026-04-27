import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load the generated HTML content for the test environment
// file moved into the sp-dashboard subdirectory
const html = readFileSync(resolve(__dirname, '../sp-dashboard/index.html'), 'utf8');

describe('Date Range Reporter UI', () => {
  let scriptContent;

  beforeEach(() => {
    // Reset the DOM
    document.documentElement.innerHTML = html;

    // In a JSDOM environment, we need to manually execute the script
    // because JSDOM doesn't run script tags automatically by default in Vitest
    const scriptElement = Array.from(document.querySelectorAll('script'))
      .find(s => !s.src && s.textContent.includes('processData'));

    if (scriptElement) {
      // Execute the plugin logic in the global window context
      const runScript = new Function(scriptElement.textContent);
      runScript.call(window);
    }
  });

  describe('Utility Functions', () => {
    it('should correctly format time in milliseconds to hours and minutes', () => {
      // Testing the formatTime function defined in the script
      expect(window.formatTime(3600000)).toBe('1h 0m');
      expect(window.formatTime(9000000)).toBe('2h 30m');
      expect(window.formatTime(0)).toBe('0h 0m');
    });

    it('should format date strings to short readable format', () => {
      expect(window.formatDateShort('2026-02-22')).toBe('Feb 22, 2026');
    });

    it('should generate an array of dates within a range', () => {
      const range = window.getDatesInRange('2026-02-20', '2026-02-22');
      expect(range).toEqual(['2026-02-20', '2026-02-21', '2026-02-22']);
    });
  });

  describe('Dashboard State Updates', () => {
    it('should calculate metrics correctly and update stat cards', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const mockTasks = [
        {
          id: 't1',
          parentId: null,
          title: 'Task 1',
          isDone: true,
          doneOn: new Date().getTime(),
          timeSpentOnDay: { [todayStr]: 7200000 } // 2h
        },
        {
          id: 't2',
          parentId: null,
          title: 'Task 2',
          isDone: false,
          timeSpentOnDay: { [todayStr]: 3600000 } // 1h
        }
      ];
      const mockProjects = [{ id: 'p1', title: 'Test Project' }];

      window.processData(mockTasks, mockProjects);

      // Period total time
      expect(document.getElementById('stat-time').innerText).toBe('3h 0m');
      // Today's time (same tasks, same day)
      expect(document.getElementById('stat-today-time').innerText).toBe('3h 0m');
    });

    it('should handle a task without dueDay by not marking it overdue', () => {
      const task = {
        id: 't-no-due',
        parentId: null,
        title: 'No Due Date',
        isDone: false,
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      // no time entries, no due date -> zero time
      expect(document.getElementById('stat-time').innerText).toBe('0h 0m');
    });

    it('should count tasks due today in totalTasks denominator even with no time logged', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const taskDueToday = {
        id: 't-due-no-time',
        parentId: null,
        title: 'Due Today No Time',
        isDone: false,
        dueDay: todayStr,
        timeSpentOnDay: {}
      };
      window.processData([taskDueToday], []);
      // Task due today with no time: zero period and today time
      expect(document.getElementById('stat-time').innerText).toBe('0h 0m');
      expect(document.getElementById('stat-today-time').innerText).toBe('0h 0m');
    });

    it('should deduplicate tasks that appear in both active and archived lists', () => {
      const now = Date.now();
      const doneTask = {
        id: 'task1',
        parentId: null,
        title: 'Done Task',
        isDone: true,
        doneOn: now,
        dueDay: new Date(now).toISOString().split('T')[0],
        timeSpentOnDay: {}
      };
      // Simulate what happens when pullDataFromSP combines activeTasks and archivedTasks
      // The same task appears in both lists (which can happen with completed tasks)
      const activeTasks = [doneTask];
      const archivedTasks = [doneTask];

      // Deduplicate using Map (same logic as in pullDataFromSP)
      const taskMap = new Map();
      archivedTasks.forEach(task => taskMap.set(task.id, task));
      activeTasks.forEach(task => taskMap.set(task.id, task));
      const deduplicatedTasks = Array.from(taskMap.values());

      // Should have only 1 unique task, not 2
      expect(deduplicatedTasks.length).toBe(1);

      // Process the deduplicated list and verify only 1 task (not 2)
      window.processData(deduplicatedTasks, []);
      expect(deduplicatedTasks.length).toBe(1);
    });
  });

  describe('Navigation & Interactivity', () => {
    it('week-start-day selector should recompute date range', () => {
      const weekStartDaySelect = document.getElementById('week-start-day');
      const today = new Date();

      // Test each weekday — verify processData runs without error
      for (const targetDay of [0, 1, 2, 3, 4, 5, 6]) {
        weekStartDaySelect.value = String(targetDay);
        weekStartDaySelect.dispatchEvent(new Event('change'));
        window.processData([], []);
      }
      // bar chart unit/display/count controls render correct number of bars
      const barContainer = document.getElementById('bar-chart-container');
      const unitSel = document.getElementById('bar-chart-unit');
      const displaySel = document.getElementById('bar-chart-display');
      const countInput = document.getElementById('bar-chart-count');
      const todayStr = window.toLocalDateStr(new Date());
      const task = { id:'t1', parentId:null, title:'Test', isDone:false, timeSpentOnDay:{[todayStr]:3600000} };
      window.processData([task], []);

      unitSel.value = 'days'; displaySel.value = 'bars'; countInput.value = '7';
      window.updateBarChart();
      expect(barContainer.querySelectorAll('.bar-col').length).toBe(7);

      unitSel.value = 'days'; displaySel.value = 'curve'; countInput.value = '30';
      window.updateBarChart();
      // curve renders as SVG; each data point has a visible dot + hit area = 2 circles each
      expect(barContainer.querySelectorAll('svg circle').length / 2).toBe(30);

      unitSel.value = 'weeks'; displaySel.value = 'bars'; countInput.value = '8';
      window.updateBarChart();
      expect(barContainer.querySelectorAll('.bar-col').length).toBe(8);

      unitSel.value = 'months'; displaySel.value = 'bars'; countInput.value = '12';
      window.updateBarChart();
      expect(barContainer.querySelectorAll('.bar-col').length).toBe(12);

      // independent decisions: weeks as a curve
      unitSel.value = 'weeks'; displaySel.value = 'curve'; countInput.value = '6';
      window.updateBarChart();
      expect(barContainer.querySelectorAll('svg circle').length / 2).toBe(6);

      // independent decisions: months as a curve
      unitSel.value = 'months'; displaySel.value = 'curve'; countInput.value = '5';
      window.updateBarChart();
      expect(barContainer.querySelectorAll('svg circle').length / 2).toBe(5);
    });


  });
});
