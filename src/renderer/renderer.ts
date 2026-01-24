/**
 * Samsara Renderer - CV Parsing UI
 *
 * Provides drag-drop interface for CV files, displays extracted data
 * with confidence highlighting.
 */

import './index.css';

// Type definitions for the API exposed via preload
interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

interface WorkEntry {
  company: string;
  position: string;
  start_date?: string;
  end_date?: string;
  description: string;
  highlights: string[];
  confidence: number;
}

interface EducationEntry {
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  confidence: number;
}

interface SkillGroup {
  category: string;
  skills: string[];
}

interface ParsedCV {
  contact: ContactInfo;
  work_history: WorkEntry[];
  education: EducationEntry[];
  skills: SkillGroup[];
  certifications: string[];
  languages: string[];
  other_sections: Record<string, string>;
  raw_text: string;
  section_order: string[];
  parse_confidence: number;
  warnings: string[];
  extract_time_ms?: number;
}

interface ExtractResult {
  success: boolean;
  data?: ParsedCV;
  id?: string;
  totalTime?: number;
  error?: string;
}

declare global {
  interface Window {
    api: {
      extractCV: (filePath: string) => Promise<ExtractResult>;
      getAllCVs: () => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
    };
  }
}

// DOM Elements
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const loadingEl = document.getElementById('loading') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
const resultsEl = document.getElementById('results') as HTMLDivElement;
const warningsEl = document.getElementById('warnings') as HTMLDivElement;

// Stats elements
const statConfidence = document.getElementById('stat-confidence') as HTMLSpanElement;
const statTime = document.getElementById('stat-time') as HTMLSpanElement;
const statFile = document.getElementById('stat-file') as HTMLSpanElement;

// Section elements
const contactGrid = document.getElementById('contact-grid') as HTMLDivElement;
const workList = document.getElementById('work-list') as HTMLDivElement;
const educationList = document.getElementById('education-list') as HTMLDivElement;
const skillsList = document.getElementById('skills-list') as HTMLDivElement;

// Parse another button
const parseAnotherBtn = document.getElementById('parse-another-btn') as HTMLButtonElement;

// Low confidence threshold (70%)
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Show/hide UI sections
 */
function showDropZone(): void {
  dropZone.classList.remove('hidden');
  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
}

function showLoading(): void {
  dropZone.classList.add('hidden');
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
}

function showError(message: string): void {
  dropZone.classList.remove('hidden');
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
  errorMessage.textContent = message;
  resultsEl.classList.add('hidden');
}

function showResults(): void {
  dropZone.classList.add('hidden');
  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  resultsEl.classList.remove('hidden');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date string for display
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  // Already formatted by Python, just return it
  return dateStr;
}

/**
 * Render contact information
 */
function renderContact(contact: ContactInfo): void {
  contactGrid.innerHTML = '';

  const fields: { key: keyof ContactInfo; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'github', label: 'GitHub' },
    { key: 'portfolio', label: 'Portfolio' },
  ];

  // Count how many fields are filled for confidence estimation
  const filledCount = fields.filter(f => contact[f.key]).length;
  const isLowConfidence = filledCount < 2;

  for (const field of fields) {
    const value = contact[field.key];
    if (value) {
      const item = document.createElement('div');
      item.className = `contact-item${isLowConfidence ? ' low-confidence' : ''}`;
      item.innerHTML = `
        <div class="contact-label">${escapeHtml(field.label)}</div>
        <div class="contact-value">${escapeHtml(value)}</div>
      `;
      contactGrid.appendChild(item);
    }
  }

  if (contactGrid.children.length === 0) {
    contactGrid.innerHTML = '<p style="color: #666; font-style: italic;">No contact information extracted</p>';
  }
}

/**
 * Render work history
 */
function renderWorkHistory(workHistory: WorkEntry[]): void {
  workList.innerHTML = '';

  if (!workHistory || workHistory.length === 0) {
    workList.innerHTML = '<p style="color: #666; font-style: italic;">No work history extracted</p>';
    return;
  }

  for (const entry of workHistory) {
    const isLow = entry.confidence < LOW_CONFIDENCE_THRESHOLD;
    const card = document.createElement('div');
    card.className = `entry-card${isLow ? ' low-confidence' : ''}`;

    const dates = [formatDate(entry.start_date), formatDate(entry.end_date) || 'Present']
      .filter(Boolean)
      .join(' - ');

    let highlightsHtml = '';
    if (entry.highlights && entry.highlights.length > 0) {
      highlightsHtml = `
        <ul class="entry-highlights">
          ${entry.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      `;
    }

    card.innerHTML = `
      <div class="entry-header">
        <div>
          <div class="entry-title">${escapeHtml(entry.position)}</div>
          <div class="entry-subtitle">${escapeHtml(entry.company)}</div>
        </div>
        <div>
          ${dates ? `<div class="entry-dates">${escapeHtml(dates)}</div>` : ''}
          <span class="confidence-badge${isLow ? ' low' : ''}">${Math.round(entry.confidence * 100)}%</span>
        </div>
      </div>
      ${entry.description ? `<div class="entry-description">${escapeHtml(entry.description)}</div>` : ''}
      ${highlightsHtml}
    `;
    workList.appendChild(card);
  }
}

/**
 * Render education
 */
function renderEducation(education: EducationEntry[]): void {
  educationList.innerHTML = '';

  if (!education || education.length === 0) {
    educationList.innerHTML = '<p style="color: #666; font-style: italic;">No education extracted</p>';
    return;
  }

  for (const entry of education) {
    const isLow = entry.confidence < LOW_CONFIDENCE_THRESHOLD;
    const card = document.createElement('div');
    card.className = `entry-card${isLow ? ' low-confidence' : ''}`;

    const dates = [formatDate(entry.start_date), formatDate(entry.end_date)]
      .filter(Boolean)
      .join(' - ');

    const degreeField = [entry.degree, entry.field_of_study].filter(Boolean).join(' in ');

    card.innerHTML = `
      <div class="entry-header">
        <div>
          <div class="entry-title">${escapeHtml(degreeField || 'Degree')}</div>
          <div class="entry-subtitle">${escapeHtml(entry.institution)}</div>
        </div>
        <div>
          ${dates ? `<div class="entry-dates">${escapeHtml(dates)}</div>` : ''}
          <span class="confidence-badge${isLow ? ' low' : ''}">${Math.round(entry.confidence * 100)}%</span>
        </div>
      </div>
      ${entry.grade ? `<div class="entry-description">Grade: ${escapeHtml(entry.grade)}</div>` : ''}
    `;
    educationList.appendChild(card);
  }
}

/**
 * Render skills
 */
function renderSkills(skills: SkillGroup[]): void {
  skillsList.innerHTML = '';

  if (!skills || skills.length === 0) {
    skillsList.innerHTML = '<p style="color: #666; font-style: italic;">No skills extracted</p>';
    return;
  }

  for (const group of skills) {
    const groupEl = document.createElement('div');
    groupEl.className = 'skill-group';
    groupEl.innerHTML = `
      <div class="skill-category">${escapeHtml(group.category)}</div>
      <div class="skill-tags">
        ${group.skills.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
      </div>
    `;
    skillsList.appendChild(groupEl);
  }
}

/**
 * Render warnings
 */
function renderWarnings(warnings: string[]): void {
  if (!warnings || warnings.length === 0) {
    warningsEl.classList.add('hidden');
    return;
  }

  warningsEl.classList.remove('hidden');
  warningsEl.innerHTML = `
    <h3>Parsing Warnings</h3>
    <ul>
      ${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
    </ul>
  `;
}

/**
 * Display parsed CV data
 */
function displayResults(data: ParsedCV, fileName: string, totalTime?: number): void {
  // Update stats
  statConfidence.textContent = `${Math.round(data.parse_confidence * 100)}%`;
  statTime.textContent = totalTime ? `${totalTime}ms` : (data.extract_time_ms ? `${data.extract_time_ms}ms` : '-');
  statFile.textContent = fileName;

  // Render sections
  renderWarnings(data.warnings);
  renderContact(data.contact);
  renderWorkHistory(data.work_history);
  renderEducation(data.education);
  renderSkills(data.skills);

  showResults();
}

/**
 * Handle file drop
 */
async function handleFileDrop(file: File): Promise<void> {
  // Validate file type
  const validExtensions = ['.pdf', '.docx', '.doc'];
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();

  if (!validExtensions.includes(ext)) {
    showError(`Unsupported file type: ${ext}. Supported formats: PDF, DOCX, DOC`);
    return;
  }

  showLoading();

  try {
    // Get file path - Electron provides this on File objects from drops
    const filePath = (file as File & { path?: string }).path;

    if (!filePath) {
      showError('Could not get file path. Please try again.');
      return;
    }

    console.log('Extracting CV from:', filePath);
    const result = await window.api.extractCV(filePath);

    if (!result.success) {
      showError(result.error || 'Unknown error during CV extraction');
      return;
    }

    if (!result.data) {
      showError('No data returned from extraction');
      return;
    }

    displayResults(result.data, file.name, result.totalTime);
  } catch (err) {
    console.error('CV extraction error:', err);
    showError(err instanceof Error ? err.message : 'Failed to extract CV');
  }
}

// Drag and drop event handlers
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('dragover');

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFileDrop(files[0]);
  }
});

// Click to select file (optional, but nice UX)
dropZone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.docx,.doc';
  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleFileDrop(files[0]);
    }
  };
  input.click();
});

// Parse another button
parseAnotherBtn.addEventListener('click', () => {
  showDropZone();
});

// Initialize
console.log('Samsara CV Parser initialized');
