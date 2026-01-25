/**
 * Test fixtures and mock data for E2E tests.
 *
 * This module provides structured test data and utilities for
 * creating test scenarios.
 */

import path from 'path';
import fs from 'fs';

/**
 * Sample CV data matching the ParsedCV interface.
 */
export interface MockCVData {
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  work_history: Array<{
    company: string;
    position: string;
    start_date?: string;
    end_date?: string;
    description: string;
    highlights: string[];
    confidence: number;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
    grade?: string;
    confidence: number;
  }>;
  skills: Array<{
    category: string;
    skills: string[];
  }>;
  certifications: string[];
  languages: string[];
  other_sections: Record<string, string>;
  raw_text: string;
  section_order: string[];
  parse_confidence: number;
  warnings: string[];
}

/**
 * Mock CV data for John Doe - Senior Full-Stack Developer (PDF fixture)
 * Corresponds to: john-doe-senior-developer.pdf
 */
export const MOCK_CV_JOHN_DOE: MockCVData = {
  contact: {
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '(555) 123-4567',
    address: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/johndoe',
    github: 'github.com/johndoe',
  },
  work_history: [
    {
      company: 'TechCorp Inc.',
      position: 'Senior Full-Stack Developer',
      start_date: '2020-03',
      end_date: 'Present',
      description: 'Led development of microservices architecture serving 2M+ users.',
      highlights: [
        'Reduced API latency by 40% through optimization',
        'Mentored team of 5 junior developers',
        'Implemented CI/CD pipelines reducing deployment time by 60%',
      ],
      confidence: 0.95,
    },
    {
      company: 'StartupXYZ',
      position: 'Full-Stack Developer',
      start_date: '2017-06',
      end_date: '2020-02',
      description: 'Built customer-facing web applications and internal tools.',
      highlights: [
        'Developed React dashboard used by 50+ enterprise clients',
        'Created automated testing framework improving code coverage to 85%',
      ],
      confidence: 0.92,
    },
    {
      company: 'WebAgency LLC',
      position: 'Junior Developer',
      start_date: '2015-01',
      end_date: '2017-05',
      description: 'Developed responsive websites and web applications for various clients.',
      highlights: [
        'Built 20+ client websites using modern web technologies',
        'Collaborated with design team on UI/UX improvements',
      ],
      confidence: 0.88,
    },
  ],
  education: [
    {
      institution: 'University of California, Berkeley',
      degree: 'Bachelor of Science',
      field_of_study: 'Computer Science',
      start_date: '2011-09',
      end_date: '2015-05',
      grade: '3.8 GPA',
      confidence: 0.94,
    },
  ],
  skills: [
    {
      category: 'Languages',
      skills: ['TypeScript', 'JavaScript', 'Python', 'Go'],
    },
    {
      category: 'Frontend',
      skills: ['React', 'Vue.js', 'Next.js', 'Tailwind CSS'],
    },
    {
      category: 'Backend',
      skills: ['Node.js', 'Express', 'FastAPI', 'PostgreSQL', 'MongoDB'],
    },
    {
      category: 'DevOps',
      skills: ['Docker', 'Kubernetes', 'AWS', 'GitHub Actions'],
    },
  ],
  certifications: ['AWS Solutions Architect Associate', 'Google Cloud Professional Developer'],
  languages: ['English (Native)', 'Spanish (Conversational)'],
  other_sections: {},
  raw_text: 'John Doe - Senior Full-Stack Developer...',
  section_order: ['contact', 'work_history', 'education', 'skills', 'certifications', 'languages'],
  parse_confidence: 0.93,
  warnings: [],
};

/**
 * Mock CV data for Jane Smith - Senior Product Manager (PDF fixture)
 * Corresponds to: jane-smith-product-manager.pdf
 */
export const MOCK_CV_JANE_SMITH: MockCVData = {
  contact: {
    name: 'Jane Smith',
    email: 'jane.smith@email.com',
    phone: '(555) 987-6543',
    address: 'New York, NY',
    linkedin: 'linkedin.com/in/janesmith',
  },
  work_history: [
    {
      company: 'GlobalTech Solutions',
      position: 'Senior Product Manager',
      start_date: '2019-01',
      end_date: 'Present',
      description: 'Led product strategy for B2B SaaS platform with $50M ARR.',
      highlights: [
        'Launched 3 major product features increasing user engagement by 45%',
        'Managed cross-functional team of 12 engineers and designers',
        'Drove product roadmap aligned with company OKRs',
      ],
      confidence: 0.94,
    },
    {
      company: 'InnovateCo',
      position: 'Product Manager',
      start_date: '2016-06',
      end_date: '2018-12',
      description: 'Owned mobile app product lifecycle from ideation to launch.',
      highlights: [
        'Shipped iOS and Android apps with 500K+ downloads',
        'Conducted user research with 200+ customer interviews',
        'Reduced churn by 25% through feature prioritization',
      ],
      confidence: 0.91,
    },
    {
      company: 'DigitalFirst Agency',
      position: 'Associate Product Manager',
      start_date: '2014-07',
      end_date: '2016-05',
      description: 'Supported product development for e-commerce clients.',
      highlights: [
        'Wrote product requirements for 15+ client projects',
        'Analyzed user data to inform product decisions',
      ],
      confidence: 0.87,
    },
  ],
  education: [
    {
      institution: 'Stanford University',
      degree: 'Master of Business Administration',
      field_of_study: 'Strategy and Technology',
      start_date: '2012-09',
      end_date: '2014-06',
      confidence: 0.95,
    },
    {
      institution: 'Northwestern University',
      degree: 'Bachelor of Arts',
      field_of_study: 'Economics',
      start_date: '2008-09',
      end_date: '2012-05',
      grade: '3.7 GPA',
      confidence: 0.93,
    },
  ],
  skills: [
    {
      category: 'Product Management',
      skills: ['Roadmap Planning', 'User Research', 'A/B Testing', 'Agile/Scrum'],
    },
    {
      category: 'Tools',
      skills: ['Jira', 'Figma', 'Amplitude', 'Mixpanel', 'Notion'],
    },
    {
      category: 'Technical',
      skills: ['SQL', 'Python (basic)', 'API Design'],
    },
  ],
  certifications: ['Certified Scrum Product Owner (CSPO)', 'Product School Certification'],
  languages: ['English (Native)', 'French (Fluent)', 'Mandarin (Basic)'],
  other_sections: {},
  raw_text: 'Jane Smith - Senior Product Manager...',
  section_order: ['contact', 'work_history', 'education', 'skills', 'certifications', 'languages'],
  parse_confidence: 0.92,
  warnings: [],
};

/**
 * Mock CV data for Alex Chen - Data Scientist (DOCX fixture)
 * Corresponds to: alex-chen-data-scientist.docx
 */
export const MOCK_CV_ALEX_CHEN: MockCVData = {
  contact: {
    name: 'Alex Chen',
    email: 'alex.chen@email.com',
    phone: '(555) 456-7890',
    address: 'Seattle, WA',
    linkedin: 'linkedin.com/in/alexchen',
    github: 'github.com/alexchen-ml',
  },
  work_history: [
    {
      company: 'DataDriven Inc.',
      position: 'Senior Data Scientist',
      start_date: '2021-02',
      end_date: 'Present',
      description: 'Lead ML initiatives for recommendation systems and fraud detection.',
      highlights: [
        'Built recommendation engine increasing user engagement by 35%',
        'Deployed fraud detection model saving $2M annually',
        'Led team of 4 data scientists on NLP projects',
      ],
      confidence: 0.93,
    },
    {
      company: 'AnalyticsCorp',
      position: 'Data Scientist',
      start_date: '2018-08',
      end_date: '2021-01',
      description: 'Developed predictive models and data pipelines.',
      highlights: [
        'Created customer segmentation model for marketing team',
        'Built ETL pipelines processing 10TB+ data daily',
        'Improved model accuracy by 20% using ensemble methods',
      ],
      confidence: 0.91,
    },
    {
      company: 'ResearchLab University',
      position: 'Research Assistant',
      start_date: '2016-09',
      end_date: '2018-05',
      description: 'Conducted research in machine learning and computer vision.',
      highlights: [
        'Published 2 papers in top-tier ML conferences',
        'Developed novel image classification algorithm',
      ],
      confidence: 0.89,
    },
  ],
  education: [
    {
      institution: 'University of Washington',
      degree: 'Master of Science',
      field_of_study: 'Data Science',
      start_date: '2016-09',
      end_date: '2018-06',
      grade: '3.9 GPA',
      confidence: 0.95,
    },
    {
      institution: 'UCLA',
      degree: 'Bachelor of Science',
      field_of_study: 'Applied Mathematics',
      start_date: '2012-09',
      end_date: '2016-06',
      grade: '3.8 GPA',
      confidence: 0.94,
    },
  ],
  skills: [
    {
      category: 'Machine Learning',
      skills: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'XGBoost', 'Deep Learning'],
    },
    {
      category: 'Programming',
      skills: ['Python', 'R', 'SQL', 'Scala'],
    },
    {
      category: 'Big Data',
      skills: ['Spark', 'Hadoop', 'Kafka', 'Airflow'],
    },
    {
      category: 'Cloud',
      skills: ['AWS SageMaker', 'GCP Vertex AI', 'MLflow'],
    },
  ],
  certifications: ['AWS Machine Learning Specialty', 'Google Cloud Professional ML Engineer'],
  languages: ['English (Fluent)', 'Mandarin (Native)'],
  other_sections: {},
  raw_text: 'Alex Chen - Senior Data Scientist...',
  section_order: ['contact', 'work_history', 'education', 'skills', 'certifications', 'languages'],
  parse_confidence: 0.92,
  warnings: [],
};

/**
 * Mock CV data for Maria Garcia - Senior UX Designer (DOCX fixture)
 * Corresponds to: maria-garcia-ux-designer.docx
 */
export const MOCK_CV_MARIA_GARCIA: MockCVData = {
  contact: {
    name: 'Maria Garcia',
    email: 'maria.garcia@email.com',
    phone: '(555) 321-0987',
    address: 'Austin, TX',
    linkedin: 'linkedin.com/in/mariagarcia',
    portfolio: 'mariagarcia.design',
  },
  work_history: [
    {
      company: 'DesignForward Studio',
      position: 'Senior UX Designer',
      start_date: '2020-06',
      end_date: 'Present',
      description: 'Lead UX designer for enterprise SaaS products.',
      highlights: [
        'Redesigned core product increasing user satisfaction by 40%',
        'Established design system used across 5 product teams',
        'Conducted 100+ user interviews and usability tests',
      ],
      confidence: 0.94,
    },
    {
      company: 'CreativeAgency Co.',
      position: 'UX Designer',
      start_date: '2017-03',
      end_date: '2020-05',
      description: 'Designed user experiences for web and mobile applications.',
      highlights: [
        'Led UX for e-commerce redesign with 25% conversion increase',
        'Created wireframes and prototypes for 30+ projects',
        'Mentored 2 junior designers',
      ],
      confidence: 0.91,
    },
    {
      company: 'TechStartup Inc.',
      position: 'UI/UX Designer',
      start_date: '2015-01',
      end_date: '2017-02',
      description: 'Sole designer responsible for product UI/UX.',
      highlights: [
        'Designed mobile app from scratch with 4.8 star rating',
        'Created brand identity and marketing materials',
      ],
      confidence: 0.88,
    },
  ],
  education: [
    {
      institution: 'Rhode Island School of Design',
      degree: 'Bachelor of Fine Arts',
      field_of_study: 'Graphic Design',
      start_date: '2010-09',
      end_date: '2014-05',
      grade: '3.7 GPA',
      confidence: 0.93,
    },
  ],
  skills: [
    {
      category: 'Design',
      skills: ['User Research', 'Wireframing', 'Prototyping', 'Design Systems', 'Accessibility'],
    },
    {
      category: 'Tools',
      skills: ['Figma', 'Sketch', 'Adobe XD', 'InVision', 'Principle'],
    },
    {
      category: 'Technical',
      skills: ['HTML/CSS', 'Basic JavaScript', 'Webflow'],
    },
  ],
  certifications: ['Google UX Design Certificate', 'Nielsen Norman UX Certification'],
  languages: ['English (Fluent)', 'Spanish (Native)', 'Portuguese (Conversational)'],
  other_sections: {},
  raw_text: 'Maria Garcia - Senior UX Designer...',
  section_order: ['contact', 'work_history', 'education', 'skills', 'certifications', 'languages'],
  parse_confidence: 0.91,
  warnings: [],
};

/**
 * Legacy alias for backward compatibility
 */
export const MOCK_CV_HIGH_CONFIDENCE: MockCVData = MOCK_CV_JOHN_DOE;

/**
 * Sample low-confidence CV data for testing warning scenarios.
 */
export const MOCK_CV_LOW_CONFIDENCE: MockCVData = {
  contact: {
    name: 'Unknown Candidate',
    email: 'unknown@example.com',
  },
  work_history: [
    {
      company: 'Unknown Company',
      position: 'Developer',
      description: 'Software development work.',
      highlights: [],
      confidence: 0.45,
    },
  ],
  education: [
    {
      institution: 'Some University',
      degree: 'Degree',
      confidence: 0.52,
    },
  ],
  skills: [
    {
      category: 'Skills',
      skills: ['JavaScript', 'HTML', 'CSS'],
    },
  ],
  certifications: [],
  languages: [],
  other_sections: {},
  raw_text: 'Unknown Candidate...',
  section_order: ['contact', 'work_history', 'education', 'skills'],
  parse_confidence: 0.55,
  warnings: [
    'Could not parse date format',
    'Company name might be incomplete',
    'Education details are sparse',
  ],
};

/**
 * Mapping of fixture file names to their corresponding mock data.
 */
export const FIXTURE_TO_MOCK_DATA: Record<string, MockCVData> = {
  'john-doe-senior-developer.pdf': MOCK_CV_JOHN_DOE,
  'jane-smith-product-manager.pdf': MOCK_CV_JANE_SMITH,
  'alex-chen-data-scientist.docx': MOCK_CV_ALEX_CHEN,
  'maria-garcia-ux-designer.docx': MOCK_CV_MARIA_GARCIA,
};

/**
 * All available mock CV data for tests.
 */
export const ALL_MOCK_CVS = [
  MOCK_CV_JOHN_DOE,
  MOCK_CV_JANE_SMITH,
  MOCK_CV_ALEX_CHEN,
  MOCK_CV_MARIA_GARCIA,
];

/**
 * Get mock data for a fixture file by name.
 */
export function getMockDataForFile(fileName: string): MockCVData | undefined {
  return FIXTURE_TO_MOCK_DATA[fileName];
}

/**
 * Interface matching QueueItem from the app.
 */
export interface MockQueueItem {
  id: string;
  fileName: string;
  fileType: string;
  filePath: string;
  status: 'submitted' | 'completed' | 'failed';
  stage?: 'Parsing...' | 'Extracting...' | 'Saving...';
  error?: string;
  data?: MockCVData;
  parseConfidence?: number;
  createdAt: string;
}

/**
 * Create mock queue items for testing.
 *
 * @param fixturesDir - Path to fixtures directory
 * @param options - Configuration options
 */
export function createMockQueueItems(
  fixturesDir: string,
  options: {
    includeCompleted?: boolean;
    includeFailed?: boolean;
    includeSubmitted?: boolean;
  } = {}
): MockQueueItem[] {
  const {
    includeCompleted = true,
    includeFailed = true,
    includeSubmitted = true,
  } = options;

  const items: MockQueueItem[] = [];
  let idCounter = 1;

  // Add completed items with mock data
  if (includeCompleted) {
    items.push({
      id: `mock-cv-${idCounter++}`,
      fileName: 'john-doe-senior-developer.pdf',
      fileType: 'pdf',
      filePath: path.join(fixturesDir, 'john-doe-senior-developer.pdf'),
      status: 'completed',
      data: MOCK_CV_JOHN_DOE,
      parseConfidence: MOCK_CV_JOHN_DOE.parse_confidence,
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    });

    items.push({
      id: `mock-cv-${idCounter++}`,
      fileName: 'jane-smith-product-manager.pdf',
      fileType: 'pdf',
      filePath: path.join(fixturesDir, 'jane-smith-product-manager.pdf'),
      status: 'completed',
      data: MOCK_CV_JANE_SMITH,
      parseConfidence: MOCK_CV_JANE_SMITH.parse_confidence,
      createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    });

    items.push({
      id: `mock-cv-${idCounter++}`,
      fileName: 'alex-chen-data-scientist.docx',
      fileType: 'docx',
      filePath: path.join(fixturesDir, 'alex-chen-data-scientist.docx'),
      status: 'completed',
      data: MOCK_CV_ALEX_CHEN,
      parseConfidence: MOCK_CV_ALEX_CHEN.parse_confidence,
      createdAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
    });

    items.push({
      id: `mock-cv-${idCounter++}`,
      fileName: 'maria-garcia-ux-designer.docx',
      fileType: 'docx',
      filePath: path.join(fixturesDir, 'maria-garcia-ux-designer.docx'),
      status: 'completed',
      data: MOCK_CV_MARIA_GARCIA,
      parseConfidence: MOCK_CV_MARIA_GARCIA.parse_confidence,
      createdAt: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
    });
  }

  // Add failed items
  if (includeFailed) {
    items.push({
      id: `mock-cv-${idCounter++}`,
      fileName: 'corrupt-file.pdf',
      fileType: 'pdf',
      filePath: path.join(fixturesDir, 'invalid.pdf'),
      status: 'failed',
      error: 'Failed to parse PDF: Invalid or corrupted file format',
      createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    });

    items.push({
      id: `mock-cv-${idCounter++}`,
      fileName: 'timeout-file.docx',
      fileType: 'docx',
      filePath: path.join(fixturesDir, 'timeout.docx'),
      status: 'failed',
      error: 'Processing timeout: The file took too long to process. Please try again.',
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 min ago
    });
  }

  // Add submitted (in-progress) items
  if (includeSubmitted) {
    items.push({
      id: `mock-cv-${idCounter++}`,
      fileName: 'processing-file.pdf',
      fileType: 'pdf',
      filePath: path.join(fixturesDir, 'sample-cv.pdf'),
      status: 'submitted',
      stage: 'Extracting...',
      createdAt: new Date().toISOString(),
    });
  }

  return items;
}

/**
 * Create a single mock queue item with specific status.
 */
export function createMockQueueItem(
  fixturesDir: string,
  overrides: Partial<MockQueueItem> = {}
): MockQueueItem {
  const defaults: MockQueueItem = {
    id: `mock-cv-${Date.now()}`,
    fileName: 'john-doe-senior-developer.pdf',
    fileType: 'pdf',
    filePath: path.join(fixturesDir, 'john-doe-senior-developer.pdf'),
    status: 'completed',
    data: MOCK_CV_JOHN_DOE,
    parseConfidence: MOCK_CV_JOHN_DOE.parse_confidence,
    createdAt: new Date().toISOString(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a minimal test PDF file with CV-like content.
 *
 * @param outputPath - Where to save the PDF
 * @param name - Name to include in the PDF content
 */
export function createMinimalTestPDF(outputPath: string, name = 'Test Candidate'): void {
  // Minimal valid PDF structure with text content
  // Note: This is a simplified PDF that may not parse well with real PDF parsers
  // For actual E2E tests with the Python backend, use real sample PDFs
  const pdfContent = `%PDF-1.4
%\xE2\xE3\xCF\xD3
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 612 792]
  /Contents 4 0 R
  /Resources << /Font << /F1 5 0 R >> >>
>>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 16 Tf
50 750 Td
(${name}) Tj
0 -20 Td
/F1 12 Tf
(Software Engineer) Tj
0 -30 Td
(Experience:) Tj
0 -15 Td
(- 5 years of software development) Tj
0 -15 Td
(- Python, JavaScript, TypeScript) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000015 00000 n
0000000066 00000 n
0000000125 00000 n
0000000266 00000 n
0000000520 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
600
%%EOF`;

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, pdfContent, 'binary');
}

/**
 * Create an invalid file for testing error handling.
 *
 * @param outputPath - Where to save the file
 * @param extension - File extension to use
 */
export function createInvalidFile(outputPath: string, extension = 'pdf'): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write random/corrupt data that won't parse as a valid document
  fs.writeFileSync(outputPath, 'This is not a valid PDF or DOCX file content.');
}

/**
 * Create a text file with .txt extension for testing unsupported file handling.
 *
 * @param outputPath - Where to save the file
 */
export function createUnsupportedFile(outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, 'This is a plain text file.');
}

/**
 * Get the path to the fixtures directory.
 */
export function getFixturesDir(): string {
  return path.resolve(__dirname);
}

/**
 * List of expected fixture files (generated by generate-fixtures.ts).
 */
export const EXPECTED_FIXTURE_FILES = {
  cvs: [
    'john-doe-senior-developer.pdf',
    'jane-smith-product-manager.pdf',
    'alex-chen-data-scientist.docx',
    'maria-garcia-ux-designer.docx',
  ],
  jds: [
    'senior-frontend-engineer-jd.pdf',
    'product-manager-growth-jd.pdf',
    'machine-learning-engineer-jd.docx',
    'senior-ux-designer-jd.docx',
  ],
};

/**
 * Check if all expected fixture files exist.
 */
export function checkFixturesExist(): { missing: string[]; exists: boolean } {
  const fixturesDir = getFixturesDir();
  const missing: string[] = [];

  for (const file of [...EXPECTED_FIXTURE_FILES.cvs, ...EXPECTED_FIXTURE_FILES.jds]) {
    if (!fs.existsSync(path.join(fixturesDir, file))) {
      missing.push(file);
    }
  }

  return { missing, exists: missing.length === 0 };
}

/**
 * Initialize test fixtures.
 * Creates necessary test files for E2E tests.
 *
 * Note: Main fixtures (CVs and JDs) should be generated using generate-fixtures.ts
 * This function creates additional utility files for error testing.
 */
export async function initializeFixtures(): Promise<void> {
  const fixturesDir = getFixturesDir();

  // Check if main fixtures exist
  const { missing, exists } = checkFixturesExist();
  if (!exists) {
    console.log('Missing fixture files:', missing);
    console.log('Run: npx ts-node e2e/fixtures/generate-fixtures.ts');
  } else {
    console.log('All main fixtures present');
  }

  // Create an invalid file for error testing
  const invalidPath = path.join(fixturesDir, 'invalid.pdf');
  if (!fs.existsSync(invalidPath)) {
    createInvalidFile(invalidPath);
    console.log('Created invalid file fixture');
  }

  // Create an unsupported file type
  const unsupportedPath = path.join(fixturesDir, 'resume.txt');
  if (!fs.existsSync(unsupportedPath)) {
    createUnsupportedFile(unsupportedPath);
    console.log('Created unsupported file fixture');
  }

  // Create sample PDF for minimal testing (fallback if generate-fixtures not run)
  const samplePdfPath = path.join(fixturesDir, 'sample-cv.pdf');
  if (!fs.existsSync(samplePdfPath)) {
    createMinimalTestPDF(samplePdfPath, 'Sample Test');
    console.log('Created sample PDF fixture (fallback)');
  }
}
