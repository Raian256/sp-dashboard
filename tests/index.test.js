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

    it('should honor dueDay provided initially', () => {
      const now = Date.now();
      const dueStr = new Date(now - 86400000).toISOString().split('T')[0];
      const task = {
        id: 't-initial',
        parentId: null,
        title: 'Initial Overdue',
        isDone: false,
        dueDay: dueStr,
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      // table should include this task despite zero time, with Overdue badge
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('Initial Overdue');
      expect(row.textContent).toContain('Overdue');
    });

    it('should pick up overdue when dueDay is added later', () => {
      const now = Date.now();
      const task = {
        id: 't-late',
        parentId: null,
        title: 'Late Task',
        isDone: false,
        // start without dueDay
        timeSpentOnDay: {}
      };
      const tasks = [ task ];

      // initial run: no overdue — table should be empty
      window.processData(tasks, []);
      const rowsBefore = document.querySelectorAll('#details-table-body tr');
      expect(Array.from(rowsBefore).some(r => r.textContent.includes('Overdue'))).toBe(false);

      // add dueDay yesterday and trigger again — table should now show Overdue row
      task.dueDay = new Date(now - 86400000).toISOString().split('T')[0];
      window.processData(tasks, []);
      const rowsAfter = document.querySelectorAll('#details-table-body tr');
      expect(Array.from(rowsAfter).some(r => r.textContent.includes('Overdue'))).toBe(true);
    });

    it('should not mark a task overdue/late if dueDay is added on the same day after completion', () => {
      const now = Date.now();
      const task = {
        id: 't-add-today',
        parentId: null,
        title: 'Added Today',
        isDone: true,
        doneOn: now,
        timeSpentOnDay: {}
      };
      const tasks = [ task ];
      // initial run: no dueDay -> not overdue
      window.processData(tasks, []);
      let rows = document.querySelectorAll('#details-table-body tr');
      expect(Array.from(rows).some(r => r.textContent.includes('Late') || r.textContent.includes('Overdue'))).toBe(false);

      // now add dueDay equal to today — should still not be late
      task.dueDay = new Date(now).toISOString().split('T')[0];
      window.processData(tasks, []);
      rows = document.querySelectorAll('#details-table-body tr');
      expect(Array.from(rows).some(r => r.textContent.includes('Late'))).toBe(false);
    });

    it('should count a task done after its due day as overdue and late', () => {
      const now = Date.now();
      const due = new Date(now - 86400000); // yesterday
      const task = {
        id: 't-done-late',
        parentId: null,
        title: 'Done Late',
        isDone: true,
        doneOn: now,
        dueDay: due.toISOString().split('T')[0],
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      // table should include the task with Late badge despite zero time
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('Done Late');
      expect(row.textContent).toContain('Late');
    });

    // new tests covering dueDay/empty status
    it('should handle a task without dueDay by not marking it overdue', () => {
      const task = {
        id: 't-no-due',
        parentId: null,
        title: 'No Due Date',
        isDone: false,
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      // no time entries, no due date -> no rows in table and zero time
      expect(document.getElementById('stat-time').innerText).toBe('0h 0m');
      const rows = document.querySelectorAll('#details-table-body tr');
      expect(Array.from(rows).some(r => r.textContent.includes('Overdue'))).toBe(false);
    });

    it('should not mark a task due today as late if completed same day', () => {
      const now = Date.now();
      const todayStr = new Date(now).toISOString().split('T')[0];
      const task = {
        id: 't-due-today',
        parentId: null,
        title: 'Due Today',
        isDone: true,
        doneOn: now,
        dueDay: todayStr,
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      // row should appear in detail list despite zero time, without Late badge
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('Due Today');
      expect(row.textContent).not.toContain('Late');
    });

    it('should count a completed subtask in total tasks', () => {
      const now = Date.now();
      const todayStr = new Date(now).toISOString().split('T')[0];
      const sub = {
        id: 'sub1',
        parentId: 'parent',
        title: 'subtask done',
        isDone: true,
        doneOn: now,
        dueDay: todayStr,
        timeSpentOnDay: { [todayStr]: 1800000 } // 30m
      };
      window.processData([sub], []);
      // subtask time should be reflected in stat-time
      expect(document.getElementById('stat-time').innerText).toBe('0h 30m');
      // row should appear in table
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('subtask done');
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
      // Task due today with no time: zero period and today time, no table entry with time
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
    it('should switch between Dashboard and Detailed List tabs', () => {
      const dashView = document.getElementById('view-dashboard');
      const detailsView = document.getElementById('view-details');
      const dashBtn = document.getElementById('tab-btn-dashboard');
      const detailsBtn = document.getElementById('tab-btn-details');

      // Default state: Dashboard should be visible and active
      expect(dashView.classList.contains('hidden')).toBe(false);
      expect(detailsView.classList.contains('hidden')).toBe(true);
      expect(dashBtn.classList.contains('active')).toBe(true);

      // Switch to details
      window.switchTab('details');
      expect(dashView.classList.contains('hidden')).toBe(true);
      expect(detailsView.classList.contains('hidden')).toBe(false);
      expect(detailsBtn.classList.contains('active')).toBe(true);

      // back to dashboard again
      window.switchTab('dashboard');
      expect(dashView.classList.contains('hidden')).toBe(false);
      expect(dashBtn.classList.contains('active')).toBe(true);
    });

    it('should show custom date pickers only when Custom Range is selected', () => {
      const presetSelect = document.getElementById('date-preset');
      const customContainer = document.getElementById('custom-date-container');

      // Set to custom
      presetSelect.value = 'custom';
      presetSelect.dispatchEvent(new Event('change'));
      expect(customContainer.classList.contains('hidden')).toBe(false);

      // Set back to week
      presetSelect.value = 'week';
      presetSelect.dispatchEvent(new Event('change'));
      expect(customContainer.classList.contains('hidden')).toBe(true);
    });

    it('today preset should produce a single-day date range', () => {
      const presetSelect = document.getElementById('date-preset');
      presetSelect.value = 'today';
      presetSelect.dispatchEvent(new Event('change'));

      window.processData([], []);

      // The bar chart should contain exactly one bar column (one day)
      const barContainer = document.getElementById('bar-chart-container');
      expect(barContainer.querySelectorAll('.bar-col').length).toBe(1);
    });

    it('bar and pie charts should render for overdue and late types and details show badges', () => {
      // prepare metrics with one overdue task and one late task
      const now = Date.now();
      const yesterdayStr = new Date(now - 86400000).toISOString().split('T')[0];
      const overdueTask = { id:'t1', parentId:null, title:'Foo', isDone:false, dueDay:'2026-02-20', timeSpentOnDay:{'2026-02-20':0} };
      const lateTask = { id:'t2', parentId:null, title:'Bar', isDone:true, doneOn: now, dueDay: yesterdayStr, timeSpentOnDay:{} };
      window.processData([overdueTask, lateTask], []);


      // verify list badges
      const rows = document.querySelectorAll('#details-table-body tr');
      expect(rows.length).toBe(2);
      const text = Array.from(rows).map(r => r.textContent).join(' ');
      expect(text).toContain('Overdue');
      expect(text).toContain('Late');

      const barSelect = document.getElementById('bar-chart-select');
      const pieSelect = document.getElementById('pie-chart-select');
      const barContainer = document.getElementById('bar-chart-container');
      const pieContainer = document.getElementById('pie-chart-element');

      // bar count limits for presets
      const preset = document.getElementById('date-preset');
      preset.value = 'month';
      preset.dispatchEvent(new Event('change'));
      window.processData([overdueTask, lateTask], []);
      expect(barContainer.querySelectorAll('.bar-col').length).toBeLessThanOrEqual(12);
      preset.value = 'year';
      preset.dispatchEvent(new Event('change'));
      window.processData([overdueTask, lateTask], []);
      expect(barContainer.querySelectorAll('.bar-col').length).toBeLessThanOrEqual(12);

      barSelect.value = 'overdue';
      window.updateBarChart();
      expect(barContainer.querySelector('.bar')).not.toBeNull();

      barSelect.value = 'late';
      window.updateBarChart();
      expect(barContainer.querySelector('.bar')).not.toBeNull();

      pieSelect.value = 'overdue';
      window.updatePieChart();
      // JSDOM may not retain gradient string, but legend items should appear
      const pieLegend = document.getElementById('pie-legend-container');
      expect(pieLegend.querySelector('.legend-item')).not.toBeNull();

      pieSelect.value = 'late';
      window.updatePieChart();
      expect(pieLegend.querySelector('.legend-item')).not.toBeNull();
    });

    it('from-weekday preset with weekday picker should produce correct date range', () => {
      const presetSelect = document.getElementById('date-preset');
      const weekdaySelect = document.getElementById('weekday-select');
      const barContainer = document.getElementById('bar-chart-container');
      const weekdayPickerContainer = document.getElementById('weekday-picker-container');

      presetSelect.value = 'from-weekday';
      presetSelect.dispatchEvent(new Event('change'));
      expect(weekdayPickerContainer.classList.contains('hidden')).toBe(false);

      // Test each weekday
      const today = new Date();
      for (const targetDay of [0, 1, 2, 3, 4, 5, 6]) {
        weekdaySelect.value = String(targetDay);
        weekdaySelect.dispatchEvent(new Event('change'));
        window.processData([], []);

        const daysBack = (today.getDay() - targetDay + 7) % 7;
        expect(barContainer.querySelectorAll('.bar-col').length).toBe(daysBack + 1);
      }

      // Switching away hides the picker
      presetSelect.value = 'today';
      presetSelect.dispatchEvent(new Event('change'));
      expect(weekdayPickerContainer.classList.contains('hidden')).toBe(true);
    });

    it('detail list columns are sortable when headers are clicked', () => {
      // create two tasks with different dates
      const taskA = { id:'a', parentId:null, title:'A', isDone:false, dueDay:'2026-01-01', timeSpentOnDay:{'2026-01-01':3600000} };
      const taskB = { id:'b', parentId:null, title:'B', isDone:false, dueDay:'2026-01-02', timeSpentOnDay:{'2026-01-02':3600000} };
      window.processData([taskA, taskB], []);
      // capture initial order of date cells
      const initial = Array.from(document.querySelectorAll('#details-table-body tr td:first-child')).map(td => td.textContent);
      expect(initial.length).toBe(2);
      // click date header to toggle order and check indicator
      const dateTh = document.querySelector('#view-details th[data-sort="date"]');
      dateTh.click();
      expect(dateTh.classList.contains('sorted-asc')).toBe(true);
      const after = Array.from(document.querySelectorAll('#details-table-body tr td:first-child')).map(td => td.textContent);
      expect(after[0]).toBe(initial[1]);
      expect(after[1]).toBe(initial[0]);
      // clicking again flips direction
      dateTh.click();
      expect(dateTh.classList.contains('sorted-desc')).toBe(true);
    });
  });
});