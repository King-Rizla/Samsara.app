/**
 * Generate test fixture files for E2E tests
 * Run with: npx ts-node e2e/fixtures/generate-fixtures.ts
 */

import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

const fixturesDir = __dirname;

// ============================================================================
// CV Data
// ============================================================================

const cvData = [
  {
    name: 'john-doe-senior-developer',
    contact: {
      name: 'John Doe',
      email: 'john.doe@email.com',
      phone: '+1 (555) 123-4567',
      linkedin: 'linkedin.com/in/johndoe',
      github: 'github.com/johndoe',
      location: 'San Francisco, CA',
    },
    summary: 'Senior Software Engineer with 8+ years of experience in full-stack development. Specialized in React, Node.js, and cloud architecture. Passionate about building scalable systems and mentoring junior developers.',
    experience: [
      {
        company: 'TechCorp Inc.',
        title: 'Senior Software Engineer',
        dates: 'Jan 2020 - Present',
        highlights: [
          'Led migration of monolithic application to microservices, reducing deployment time by 70%',
          'Architected real-time data pipeline processing 10M+ events daily',
          'Mentored team of 5 junior developers, improving team velocity by 40%',
        ],
      },
      {
        company: 'StartupXYZ',
        title: 'Full Stack Developer',
        dates: 'Jun 2016 - Dec 2019',
        highlights: [
          'Built customer-facing React application serving 500K+ monthly users',
          'Implemented CI/CD pipeline reducing release cycles from weeks to days',
          'Optimized database queries resulting in 60% performance improvement',
        ],
      },
    ],
    education: [
      {
        institution: 'Stanford University',
        degree: 'M.S. Computer Science',
        dates: '2014 - 2016',
      },
      {
        institution: 'UC Berkeley',
        degree: 'B.S. Computer Science',
        dates: '2010 - 2014',
      },
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB'],
  },
  {
    name: 'jane-smith-product-manager',
    contact: {
      name: 'Jane Smith',
      email: 'jane.smith@email.com',
      phone: '+1 (555) 987-6543',
      linkedin: 'linkedin.com/in/janesmith',
      location: 'New York, NY',
    },
    summary: 'Product Manager with 6 years of experience driving product strategy and execution. Track record of launching successful B2B SaaS products. Data-driven decision maker with strong technical background.',
    experience: [
      {
        company: 'Enterprise Software Co.',
        title: 'Senior Product Manager',
        dates: 'Mar 2021 - Present',
        highlights: [
          'Launched enterprise analytics platform generating $5M ARR in first year',
          'Defined product roadmap aligned with company OKRs, achieving 95% delivery rate',
          'Conducted 100+ customer interviews to identify market opportunities',
        ],
      },
      {
        company: 'Growth Startup',
        title: 'Product Manager',
        dates: 'Aug 2018 - Feb 2021',
        highlights: [
          'Grew user base from 10K to 150K through feature optimization',
          'Reduced customer churn by 25% through improved onboarding flow',
          'Collaborated with engineering team of 12 to deliver quarterly releases',
        ],
      },
    ],
    education: [
      {
        institution: 'Harvard Business School',
        degree: 'MBA',
        dates: '2016 - 2018',
      },
      {
        institution: 'MIT',
        degree: 'B.S. Engineering',
        dates: '2012 - 2016',
      },
    ],
    skills: ['Product Strategy', 'Agile/Scrum', 'Data Analysis', 'SQL', 'Figma', 'Jira', 'A/B Testing', 'User Research'],
  },
  {
    name: 'alex-chen-data-scientist',
    contact: {
      name: 'Alex Chen',
      email: 'alex.chen@email.com',
      phone: '+1 (555) 456-7890',
      linkedin: 'linkedin.com/in/alexchen',
      github: 'github.com/alexchen-ml',
      location: 'Seattle, WA',
    },
    summary: 'Data Scientist with expertise in machine learning and statistical modeling. 5 years of experience building predictive models and data pipelines. Published researcher in NLP and computer vision.',
    experience: [
      {
        company: 'AI Research Labs',
        title: 'Senior Data Scientist',
        dates: 'Jul 2021 - Present',
        highlights: [
          'Developed recommendation engine increasing user engagement by 35%',
          'Built NLP pipeline for sentiment analysis processing 1M+ reviews daily',
          'Published 3 papers at top-tier ML conferences (NeurIPS, ICML)',
        ],
      },
      {
        company: 'DataDriven Inc.',
        title: 'Data Scientist',
        dates: 'Jan 2019 - Jun 2021',
        highlights: [
          'Created fraud detection model saving company $2M annually',
          'Implemented MLOps infrastructure reducing model deployment time by 80%',
          'Trained and deployed computer vision models for quality control',
        ],
      },
    ],
    education: [
      {
        institution: 'Carnegie Mellon University',
        degree: 'Ph.D. Machine Learning',
        dates: '2015 - 2019',
      },
      {
        institution: 'Tsinghua University',
        degree: 'B.S. Computer Science',
        dates: '2011 - 2015',
      },
    ],
    skills: ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'SQL', 'Spark', 'AWS SageMaker', 'MLflow', 'Statistics'],
  },
  {
    name: 'maria-garcia-ux-designer',
    contact: {
      name: 'Maria Garcia',
      email: 'maria.garcia@email.com',
      phone: '+1 (555) 321-0987',
      portfolio: 'mariagarcia.design',
      linkedin: 'linkedin.com/in/mariagarcia',
      location: 'Austin, TX',
    },
    summary: 'UX Designer with 7 years of experience creating user-centered digital experiences. Expertise in design systems, user research, and accessibility. Passionate about inclusive design.',
    experience: [
      {
        company: 'Design Forward Agency',
        title: 'Lead UX Designer',
        dates: 'Sep 2020 - Present',
        highlights: [
          'Led design system initiative adopted by 50+ designers across organization',
          'Improved app accessibility score from 65% to 98% WCAG compliance',
          'Conducted usability studies with 200+ participants',
        ],
      },
      {
        company: 'Consumer Tech Co.',
        title: 'UX Designer',
        dates: 'Mar 2017 - Aug 2020',
        highlights: [
          'Redesigned checkout flow reducing cart abandonment by 30%',
          'Created design language system used across 5 product lines',
          'Mentored 3 junior designers in user research methodologies',
        ],
      },
    ],
    education: [
      {
        institution: 'Rhode Island School of Design',
        degree: 'MFA Graphic Design',
        dates: '2015 - 2017',
      },
      {
        institution: 'University of Texas',
        degree: 'B.A. Psychology',
        dates: '2011 - 2015',
      },
    ],
    skills: ['Figma', 'Sketch', 'Adobe XD', 'Prototyping', 'User Research', 'Accessibility', 'Design Systems', 'HTML/CSS'],
  },
];

// ============================================================================
// Job Description Data
// ============================================================================

const jdData = [
  {
    name: 'senior-frontend-engineer-jd',
    company: 'TechVentures Inc.',
    title: 'Senior Frontend Engineer',
    location: 'Remote (US)',
    salary: '$150,000 - $200,000',
    about: 'TechVentures is a fast-growing startup revolutionizing the fintech space. We are building the next generation of financial tools for modern businesses.',
    responsibilities: [
      'Lead frontend architecture decisions and technical direction',
      'Build and maintain React-based web applications',
      'Collaborate with product and design teams to deliver exceptional user experiences',
      'Mentor junior developers and conduct code reviews',
      'Drive frontend best practices including testing, accessibility, and performance',
    ],
    requirements: [
      '5+ years of experience with modern JavaScript/TypeScript',
      'Expert knowledge of React and state management (Redux, Zustand)',
      'Experience with testing frameworks (Jest, Cypress, Playwright)',
      'Strong understanding of web performance optimization',
      'Excellent communication and collaboration skills',
    ],
    niceToHave: [
      'Experience with Next.js or similar frameworks',
      'Knowledge of design systems and component libraries',
      'Familiarity with GraphQL',
      'Open source contributions',
    ],
    benefits: [
      'Competitive salary and equity',
      'Unlimited PTO',
      'Health, dental, and vision insurance',
      'Home office stipend',
      '401(k) matching',
    ],
  },
  {
    name: 'product-manager-growth-jd',
    company: 'ScaleUp Corp',
    title: 'Product Manager - Growth',
    location: 'San Francisco, CA (Hybrid)',
    salary: '$140,000 - $180,000',
    about: 'ScaleUp Corp is a Series B startup transforming how businesses manage their operations. We serve 10,000+ customers globally.',
    responsibilities: [
      'Own the growth product roadmap and strategy',
      'Define and track key growth metrics (activation, retention, expansion)',
      'Run experiments to optimize user onboarding and engagement',
      'Partner with engineering, design, and marketing teams',
      'Conduct user research and competitive analysis',
    ],
    requirements: [
      '4+ years of product management experience',
      'Experience with growth/PLG products',
      'Strong analytical skills and data-driven mindset',
      'Track record of shipping products that drive measurable results',
      'Excellent stakeholder management skills',
    ],
    niceToHave: [
      'Experience with B2B SaaS products',
      'Technical background or CS degree',
      'Experience with experimentation platforms',
      'SQL proficiency',
    ],
    benefits: [
      'Competitive compensation package',
      'Flexible work arrangements',
      'Professional development budget',
      'Team offsites and events',
      'Parental leave',
    ],
  },
  {
    name: 'machine-learning-engineer-jd',
    company: 'AI Dynamics',
    title: 'Machine Learning Engineer',
    location: 'Boston, MA',
    salary: '$160,000 - $220,000',
    about: 'AI Dynamics is pioneering applied AI for healthcare. Our platform helps doctors make better decisions through advanced machine learning.',
    responsibilities: [
      'Design and implement ML models for medical diagnosis assistance',
      'Build and maintain ML infrastructure and pipelines',
      'Collaborate with research scientists to productionize models',
      'Ensure model fairness, explainability, and regulatory compliance',
      'Contribute to technical documentation and knowledge sharing',
    ],
    requirements: [
      'MS/PhD in Computer Science, ML, or related field',
      '3+ years of industry ML experience',
      'Proficiency in Python and ML frameworks (PyTorch, TensorFlow)',
      'Experience with MLOps tools (MLflow, Kubeflow, etc.)',
      'Strong foundation in statistics and probability',
    ],
    niceToHave: [
      'Healthcare or regulated industry experience',
      'Publications in top ML venues',
      'Experience with federated learning',
      'Knowledge of medical imaging or NLP',
    ],
    benefits: [
      'Top-tier compensation',
      'Research publication support',
      'Conference attendance budget',
      'Sabbatical program',
      'Stock options',
    ],
  },
  {
    name: 'senior-ux-designer-jd',
    company: 'DesignFirst Studios',
    title: 'Senior UX Designer',
    location: 'New York, NY (Hybrid)',
    salary: '$130,000 - $170,000',
    about: 'DesignFirst Studios is a leading design agency working with Fortune 500 companies to create world-class digital experiences.',
    responsibilities: [
      'Lead end-to-end design for client projects',
      'Conduct user research and translate insights into designs',
      'Create wireframes, prototypes, and high-fidelity mockups',
      'Present design concepts to clients and stakeholders',
      'Contribute to and evolve our design system',
    ],
    requirements: [
      '5+ years of UX design experience',
      'Strong portfolio demonstrating user-centered design process',
      'Expert in Figma and prototyping tools',
      'Experience conducting user research and usability testing',
      'Excellent presentation and communication skills',
    ],
    niceToHave: [
      'Agency experience',
      'Motion design skills',
      'Front-end development knowledge',
      'Experience with design tokens',
    ],
    benefits: [
      'Creative freedom',
      'Work with top brands',
      'Learning and development budget',
      'Flexible hours',
      'Annual design conference attendance',
    ],
  },
];

// ============================================================================
// PDF Generation
// ============================================================================

function generateCVPdf(cv: typeof cvData[0]): void {
  const doc = new PDFDocument({ margin: 50 });
  const filePath = path.join(fixturesDir, `${cv.name}.pdf`);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text(cv.contact.name, { align: 'center' });
  doc.moveDown(0.5);

  const contactLine = [cv.contact.email, cv.contact.phone, cv.contact.location].filter(Boolean).join(' | ');
  doc.fontSize(10).font('Helvetica').text(contactLine, { align: 'center' });

  if (cv.contact.linkedin || cv.contact.github || cv.contact.portfolio) {
    const links = [cv.contact.linkedin, cv.contact.github, cv.contact.portfolio].filter(Boolean).join(' | ');
    doc.text(links, { align: 'center' });
  }

  doc.moveDown();

  // Summary
  doc.fontSize(14).font('Helvetica-Bold').text('Professional Summary');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text(cv.summary);
  doc.moveDown();

  // Experience
  doc.fontSize(14).font('Helvetica-Bold').text('Experience');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  for (const exp of cv.experience) {
    doc.fontSize(12).font('Helvetica-Bold').text(exp.title);
    doc.fontSize(10).font('Helvetica').text(`${exp.company} | ${exp.dates}`);
    doc.moveDown(0.3);
    for (const highlight of exp.highlights) {
      doc.text(`• ${highlight}`, { indent: 20 });
    }
    doc.moveDown(0.5);
  }

  // Education
  doc.fontSize(14).font('Helvetica-Bold').text('Education');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  for (const edu of cv.education) {
    doc.fontSize(11).font('Helvetica-Bold').text(edu.degree);
    doc.fontSize(10).font('Helvetica').text(`${edu.institution} | ${edu.dates}`);
    doc.moveDown(0.3);
  }

  // Skills
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text('Skills');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text(cv.skills.join(' • '));

  doc.end();
  console.log(`Created: ${filePath}`);
}

function generateJDPdf(jd: typeof jdData[0]): void {
  const doc = new PDFDocument({ margin: 50 });
  const filePath = path.join(fixturesDir, `${jd.name}.pdf`);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(jd.title, { align: 'center' });
  doc.fontSize(14).font('Helvetica').text(jd.company, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).text(`${jd.location} | ${jd.salary}`, { align: 'center' });
  doc.moveDown();

  // About
  doc.fontSize(14).font('Helvetica-Bold').text('About Us');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text(jd.about);
  doc.moveDown();

  // Responsibilities
  doc.fontSize(14).font('Helvetica-Bold').text('Responsibilities');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  for (const item of jd.responsibilities) {
    doc.fontSize(10).font('Helvetica').text(`• ${item}`, { indent: 20 });
  }
  doc.moveDown();

  // Requirements
  doc.fontSize(14).font('Helvetica-Bold').text('Requirements');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  for (const item of jd.requirements) {
    doc.fontSize(10).font('Helvetica').text(`• ${item}`, { indent: 20 });
  }
  doc.moveDown();

  // Nice to Have
  doc.fontSize(14).font('Helvetica-Bold').text('Nice to Have');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  for (const item of jd.niceToHave) {
    doc.fontSize(10).font('Helvetica').text(`• ${item}`, { indent: 20 });
  }
  doc.moveDown();

  // Benefits
  doc.fontSize(14).font('Helvetica-Bold').text('Benefits');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  for (const item of jd.benefits) {
    doc.fontSize(10).font('Helvetica').text(`• ${item}`, { indent: 20 });
  }

  doc.end();
  console.log(`Created: ${filePath}`);
}

// ============================================================================
// DOCX Generation
// ============================================================================

async function generateCVDocx(cv: typeof cvData[0]): Promise<void> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Name
        new Paragraph({
          children: [new TextRun({ text: cv.contact.name, bold: true, size: 48 })],
          alignment: 'center' as const,
        }),
        // Contact
        new Paragraph({
          children: [new TextRun({ text: [cv.contact.email, cv.contact.phone, cv.contact.location].filter(Boolean).join(' | '), size: 20 })],
          alignment: 'center' as const,
        }),
        new Paragraph({
          children: [new TextRun({ text: [cv.contact.linkedin, cv.contact.github, cv.contact.portfolio].filter(Boolean).join(' | '), size: 20 })],
          alignment: 'center' as const,
        }),
        new Paragraph({ children: [] }),

        // Summary
        new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: cv.summary }),
        new Paragraph({ children: [] }),

        // Experience
        new Paragraph({ text: 'Experience', heading: HeadingLevel.HEADING_1 }),
        ...cv.experience.flatMap(exp => [
          new Paragraph({ children: [new TextRun({ text: exp.title, bold: true })] }),
          new Paragraph({ text: `${exp.company} | ${exp.dates}` }),
          ...exp.highlights.map(h => new Paragraph({ text: `• ${h}`, indent: { left: 720 } })),
          new Paragraph({ children: [] }),
        ]),

        // Education
        new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_1 }),
        ...cv.education.flatMap(edu => [
          new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true })] }),
          new Paragraph({ text: `${edu.institution} | ${edu.dates}` }),
          new Paragraph({ children: [] }),
        ]),

        // Skills
        new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: cv.skills.join(' • ') }),
      ],
    }],
  });

  const filePath = path.join(fixturesDir, `${cv.name}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  console.log(`Created: ${filePath}`);
}

async function generateJDDocx(jd: typeof jdData[0]): Promise<void> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header
        new Paragraph({
          children: [new TextRun({ text: jd.title, bold: true, size: 40 })],
          alignment: 'center' as const,
        }),
        new Paragraph({
          children: [new TextRun({ text: jd.company, size: 28 })],
          alignment: 'center' as const,
        }),
        new Paragraph({
          children: [new TextRun({ text: `${jd.location} | ${jd.salary}`, size: 20 })],
          alignment: 'center' as const,
        }),
        new Paragraph({ children: [] }),

        // About
        new Paragraph({ text: 'About Us', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: jd.about }),
        new Paragraph({ children: [] }),

        // Responsibilities
        new Paragraph({ text: 'Responsibilities', heading: HeadingLevel.HEADING_1 }),
        ...jd.responsibilities.map(item => new Paragraph({ text: `• ${item}`, indent: { left: 720 } })),
        new Paragraph({ children: [] }),

        // Requirements
        new Paragraph({ text: 'Requirements', heading: HeadingLevel.HEADING_1 }),
        ...jd.requirements.map(item => new Paragraph({ text: `• ${item}`, indent: { left: 720 } })),
        new Paragraph({ children: [] }),

        // Nice to Have
        new Paragraph({ text: 'Nice to Have', heading: HeadingLevel.HEADING_1 }),
        ...jd.niceToHave.map(item => new Paragraph({ text: `• ${item}`, indent: { left: 720 } })),
        new Paragraph({ children: [] }),

        // Benefits
        new Paragraph({ text: 'Benefits', heading: HeadingLevel.HEADING_1 }),
        ...jd.benefits.map(item => new Paragraph({ text: `• ${item}`, indent: { left: 720 } })),
      ],
    }],
  });

  const filePath = path.join(fixturesDir, `${jd.name}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  console.log(`Created: ${filePath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Generating test fixtures...\n');

  // Generate CVs (2 PDF, 2 DOCX)
  console.log('=== CVs ===');
  generateCVPdf(cvData[0]);  // John Doe - PDF
  generateCVPdf(cvData[1]);  // Jane Smith - PDF
  await generateCVDocx(cvData[2]);  // Alex Chen - DOCX
  await generateCVDocx(cvData[3]);  // Maria Garcia - DOCX

  console.log('\n=== Job Descriptions ===');
  // Generate JDs (2 PDF, 2 DOCX)
  generateJDPdf(jdData[0]);  // Senior Frontend - PDF
  generateJDPdf(jdData[1]);  // Product Manager - PDF
  await generateJDDocx(jdData[2]);  // ML Engineer - DOCX
  await generateJDDocx(jdData[3]);  // UX Designer - DOCX

  console.log('\nDone! Generated 4 CVs and 4 Job Descriptions.');
}

main().catch(console.error);
