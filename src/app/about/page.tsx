import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About | built IT 2K26',
  description:
    "About the CSIT Department & Explorer's Club, its office bearers, built IT 2K26 rules and regulations, and the developers behind the platform.",
};

const RULES: string[] = [
  'Eligibility: The hackathon is open to all II & III Year CSIT students.',
  'Team Size: Each team must consist of exactly 3 members. A participant can be part of only one team.',
  'Domains: Teams may select a problem statement from any of the specified domains or participate under Open Innovation.',
  'Originality: All solutions must be original work of the participating team. Any copied or substantially reused project may be disqualified.',
  'Development: Teams must develop their solution during the designated hackathon period. Pre-existing projects may be used only as supporting components, if permitted by the organizers.',
  'Technology: Teams are free to choose appropriate programming languages, frameworks, APIs, and tools relevant to their solution.',
  'AI Usage: AI tools may be used as development aids, but teams must understand and demonstrate their implementation.',
  'Submission: Each team must submit a working prototype along with the required project details/source code before the submission deadline.',
  'Public Repository: The team\u2019s Git repository must be made public before the final submission deadline so the organizers and judges can review the source code.',
  'Presentation: Teams must demonstrate their prototype and explain the problem, approach, technology used, and key features to the judges.',
  'Evaluation: Projects will be evaluated based on innovation, problem relevance, technical implementation, functionality, usability, and presentation.',
  'Time Limit: Teams must strictly follow the hackathon timeline. Late submissions may not be considered for evaluation.',
  'Disqualification: Any form of plagiarism, misconduct, unfair practices, or violation of hackathon rules may result in disqualification.',
  "Organizer's Decision: The decisions of the judging panel and organizing committee will be final.",
];

interface Designation {
  name: string;
  role: string;
}

const DESIGNATIONS: Designation[] = [
  { name: 'Omprakash Chandragiri', role: 'President' },
  { name: 'Sai Sujith Bandlapalli Venkatarathnam', role: 'Secretary' },
  { name: 'Devisri Desu', role: 'Treasurer' },
  { name: 'Balakrishna Reddy Alluru', role: 'Vice President' },
  { name: 'Sai Sahithi Mallela', role: 'Joint Secretary' },
  { name: 'Nikhilaakshara P', role: 'Joint Secretary' },
];

interface Developer {
  name: string;
  initials: string;
  github: string;
  linkedin: string;
  email: string;
}

const DEVELOPERS: Developer[] = [
  {
    name: 'Sai Sujith Bandlapalli Venkatarathnam',
    initials: 'SS',
    github: 'https://github.com/bvsaisujith',
    linkedin: 'https://www.linkedin.com/in/sai-sujith-bv-bb582a385',
    email: 'bvsaisujith27@gmail.com',
  },
  {
    name: 'Omprakash Chandragiri',
    initials: 'OC',
    github: 'https://github.com/omprakashchandragiri657-dot',
    linkedin: 'https://www.linkedin.com/in/omprakash-chandragiri-b60614390/',
    email: 'omprakashchandragiri657@gmail.com',
  },
];

export default function AboutPage() {
  return (
    <div className="about-page">
      {/* 01 — The hosts */}
      <section className="section-frame" id="about">
        <div className="section-index">01 <span>/</span> THE HOSTS</div>
        <div className="intro-grid" data-reveal data-reveal-stagger>
          <h2>Department of CSIT.<br /><em>Explorer&apos;s Club.</em></h2>
          <div className="intro-copy">
            <p>
              built IT 2K26 is organized by the <strong>Department of Computer Science &amp; Information Technology</strong>,
              Annamacharya Institute of Technology &amp; Sciences, Tirupati — and run by the{' '}
              <strong>CSIT Explorer&apos;s Club</strong>, the department&apos;s student community for exploration,
              experimentation and hands-on building.
            </p>
            <p className="muted" style={{ marginTop: '12px' }}>
              The club exists to take learning beyond the classroom: hackathons, workshops and student-led builds
              that turn curious second- and third-year students into confident developers. built IT 2K26 — Future of IT —
              is its flagship event.
            </p>
            <a
              href="https://aits-tpt.edu.in"
              target="_blank"
              rel="noopener noreferrer"
              className="arrow-link"
              style={{ marginTop: '24px' }}
            >
              aits-tpt.edu.in <span>↗</span>
            </a>
          </div>
        </div>

        <div className="about-people" data-reveal data-reveal-stagger>
          <div className="about-person">
            <span className="about-person-role">Head of Department</span>
            <strong>Mr. V. Sambasiva</strong>
            <span className="about-person-title">Assistant Professor &amp; HOD — CSIT</span>
          </div>
          <div className="about-person">
            <span className="about-person-role">Faculty Coordinator</span>
            <strong>Mrs. P. Bhavya</strong>
            <span className="about-person-title">Assistant Professor — CSIT</span>
          </div>
          <div className="about-person">
            <span className="about-person-role">Organizing Body</span>
            <strong>CSIT Explorer&apos;s Club</strong>
            <span className="about-person-title">AITS Tirupati · Dept. of CSIT</span>
          </div>
        </div>
      </section>

      {/* 02 — CSIT Explorer's Club office bearers */}
      <section className="section-frame" id="designations" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="section-heading" data-reveal>
          <div className="section-index">02 <span>/</span> OFFICE BEARERS</div>
          <p>CSIT Explorer&apos;s Club designations — the student office bearers behind built IT 2K26.</p>
        </div>
        <div className="about-people designation-grid" data-reveal data-reveal-stagger>
          {DESIGNATIONS.map((member, index) => (
            <div key={`${member.role}-${member.name}`} className="about-person">
              <span className="about-person-role">
                {String(index + 1).padStart(2, '0')} · {member.role}
              </span>
              <strong>{member.name}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* 03 — Rules & regulations */}
      <section className="section-frame" id="rules" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="section-heading" data-reveal>
          <div className="section-index">03 <span>/</span> RULES</div>
          <p>Rules &amp; Regulations. Read them before you build — the judges will.</p>
        </div>
        <ol className="rules-list" data-reveal data-reveal-stagger>
          {RULES.map((rule, index) => (
            <li key={index} className="rule-item">
              <span className="rule-number">{String(index + 1).padStart(2, '0')}</span>
              <p>{rule}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 04 — Developers */}
      <section className="section-frame" id="developers" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="section-heading" data-reveal>
          <div className="section-index">04 <span>/</span> DEVELOPERS</div>
          <p>The platform behind built IT 2K26 — designed and built in-house.</p>
        </div>
        <div className="dev-grid" data-reveal data-reveal-stagger>
          {DEVELOPERS.map(dev => (
            <div key={dev.name} className="dev-card">
              <div className="dev-card-top">
                <span className="dev-avatar" aria-hidden="true">&lt; {dev.initials} &gt;</span>
                <div>
                  <strong>{dev.name}</strong>
                  <span className="dev-role">Developer — built IT 2K26</span>
                </div>
              </div>
              <div className="dev-links">
                <a href={dev.github} target="_blank" rel="noopener noreferrer">GitHub <span>↗</span></a>
                <a href={dev.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn <span>↗</span></a>
                <a href={`mailto:${dev.email}`} className="dev-mail">{dev.email}</a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-frame final-cta" data-reveal data-reveal-stagger style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="cta-brackets">&lt; / &gt;</div>
        <p className="eyebrow">21 SEPTEMBER 2026</p>
        <h2>Ready to build<br /><span>what&apos;s next?</span></h2>
        <Link href="/login" className="btn-primary">Join built IT 2K26 <span>↗</span></Link>
      </section>
    </div>
  );
}
