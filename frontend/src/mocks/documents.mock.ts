import type { KnowledgeDocument } from './entities.types';
import { MOCK_USER_ID, DOCUMENT_IDS } from './mockIds';

// One document per KnowledgeDocumentType (there are exactly 10 types and
// 10 requested objects — convenient full coverage). Only doc001's summary
// is written at the real target length (300-500 words per the actual
// schema's AI-generation instruction); the rest are intentionally shorter
// for practicality — this is mock data, not a claim that every real
// extraction produces a short summary.
export const documentsMock: KnowledgeDocument[] = [
  {
    id: DOCUMENT_IDS[0],
    userId: MOCK_USER_ID,
    type: 'CONTRACT',
    title: 'Master Services Agreement - Acme Corp',
    description: 'MSA governing the ongoing engagement between Acme Corporation and Zamp.',
    summary: `Overview

This Master Services Agreement ("MSA") is entered into between Acme Corporation ("Client") and Zamp ("Provider"), effective as of the date below, and governs the terms under which Provider will deliver software development and support services to Client on an ongoing basis. This agreement establishes the general framework for the relationship; individual engagements will be governed by separate Statements of Work executed under this MSA.

Key Terms

• Provider will deliver services as described in individual Statements of Work (SOWs), each of which will specify scope, deliverables, timeline, and fees.
• Client will pay invoices within 30 days of receipt unless otherwise specified in an SOW.
• Either party may terminate this MSA with 60 days' written notice; active SOWs will continue until completion unless mutually terminated.
• Provider retains ownership of any pre-existing tools, frameworks, or intellectual property used in delivering services, while deliverables specifically created for Client become Client's property upon full payment.

Important Dates

• Effective date: August 1, 2026
• Initial term: 24 months, with automatic renewal for successive 12-month periods unless either party provides notice of non-renewal at least 90 days before the renewal date.

Key Obligations

Provider must maintain adequate insurance coverage throughout the term and notify Client promptly of any material changes to its ability to perform. Client must provide timely access to systems, personnel, and information reasonably required for Provider to perform the services. Both parties must maintain confidentiality of proprietary information exchanged under this agreement, with confidentiality obligations surviving termination for five years.

Important Clauses

Limitation of liability caps each party's aggregate liability at the total fees paid under the applicable SOW in the preceding 12 months, except for breaches of confidentiality or IP obligations, which are uncapped. The agreement includes a mutual indemnification clause covering third-party claims arising from each party's negligence or willful misconduct.

Risks and Considerations

The auto-renewal clause means this agreement will continue indefinitely unless proactively cancelled — worth flagging for calendar reminders ahead of each renewal window. The liability cap may be lower than the actual value of services being delivered as the relationship scales, which is worth revisiting at renewal.`,
    documentNumber: 'MSA-2026-0142',
    issuer: { name: 'Zamp', email: 'legal@zamp.com' },
    parties: [
      { name: 'Acme Corporation', role: 'CUSTOMER' },
      { name: 'Zamp', role: 'VENDOR' },
    ],
    effectiveDate: '2026-08-01T00:00:00Z',
    expiryDate: '2028-08-01T00:00:00Z',
    attachments: [{ attachmentId: 'att_msa_001', fileName: 'acme-msa-2026.pdf' }],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-001',
    sourceType: 'EMAIL',
    threadId: 'th-doc-001',
    messageId: 'msg-doc-001',
    metadata: { governingLaw: 'Delaware' },
    createdAt: '2026-08-01T09:12:00Z',
    updatedAt: '2026-08-01T09:12:00Z',
  },
  {
    id: DOCUMENT_IDS[1],
    userId: MOCK_USER_ID,
    type: 'NDA',
    title: 'Mutual Non-Disclosure Agreement - Acme Corp',
    description: 'Mutual NDA between Acme Corporation and Zamp covering confidential business information.',
    summary:
      'Standard mutual NDA covering confidential technical and business information shared during discussions. Confidentiality obligations survive for 3 years after termination. No indemnification or liability clauses beyond confidentiality.',
    documentNumber: 'NDA-2026-1042',
    issuer: { name: 'Acme Corporation', email: 'legal@acme.com' },
    parties: [
      { name: 'Acme Corporation', role: 'CUSTOMER' },
      { name: 'Zamp', role: 'VENDOR' },
    ],
    effectiveDate: '2026-07-15T00:00:00Z',
    expiryDate: '2029-07-15T00:00:00Z',
    attachments: [{ attachmentId: 'att_nda_001', fileName: 'acme-nda-2026.pdf' }],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-002',
    sourceType: 'EMAIL',
    threadId: 'th-doc-002',
    messageId: 'msg-doc-002',
    metadata: {},
    createdAt: '2026-07-15T14:30:00Z',
    updatedAt: '2026-07-15T14:30:00Z',
  },
  {
    id: DOCUMENT_IDS[2],
    userId: MOCK_USER_ID,
    type: 'TERMS_AND_CONDITIONS',
    title: 'Terms and Conditions Update - Q3 2026',
    description: 'Updated terms of service for the vendor platform, effective Q3 2026.',
    summary:
      'Revised terms clarify data retention practices and add an arbitration clause for dispute resolution. Users are automatically bound by continuing to use the service after the effective date. No changes to pricing or core service commitments.',
    documentNumber: null,
    issuer: { name: 'CloudPlatform Inc', email: 'legal@cloudplatform.example' },
    parties: [],
    effectiveDate: '2026-09-01T00:00:00Z',
    expiryDate: null,
    attachments: [],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-003',
    sourceType: 'EMAIL',
    threadId: 'th-doc-003',
    messageId: 'msg-doc-003',
    metadata: {},
    createdAt: '2026-08-20T11:00:00Z',
    updatedAt: '2026-08-20T11:00:00Z',
  },
  {
    id: DOCUMENT_IDS[3],
    userId: MOCK_USER_ID,
    type: 'PRIVACY_POLICY',
    title: 'Updated Privacy Policy',
    description: 'Annual privacy policy update reflecting new data processing partners.',
    summary:
      'Adds two new sub-processors for email delivery and analytics. Data retention period for inactive accounts reduced from 24 months to 12 months. Right-to-deletion request process now includes a 30-day response commitment.',
    documentNumber: null,
    issuer: { name: 'Acme Corporation', email: 'privacy@acme.com' },
    parties: [],
    effectiveDate: '2026-06-01T00:00:00Z',
    expiryDate: null,
    attachments: [],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-004',
    sourceType: 'EMAIL',
    threadId: 'th-doc-004',
    messageId: 'msg-doc-004',
    metadata: {},
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
  },
  {
    id: DOCUMENT_IDS[4],
    userId: MOCK_USER_ID,
    type: 'COMPLIANCE',
    title: 'SOC 2 Type II Report',
    description: 'Annual SOC 2 Type II compliance report covering security, availability, and confidentiality.',
    summary:
      'Independent auditor report covering the 12-month period ending June 2026. No material exceptions noted across security, availability, and confidentiality trust criteria. Recommends tightening access review cadence from quarterly to monthly.',
    documentNumber: 'SOC2-2026-A',
    issuer: { name: 'Independent Audit Partners LLC', email: 'reports@auditpartners.example' },
    parties: [],
    effectiveDate: '2026-07-01T00:00:00Z',
    expiryDate: '2027-07-01T00:00:00Z',
    attachments: [{ attachmentId: 'att_soc2_001', fileName: 'soc2-type2-2026.pdf' }],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-005',
    sourceType: 'EMAIL',
    threadId: 'th-doc-005',
    messageId: 'msg-doc-005',
    metadata: {},
    createdAt: '2026-07-05T10:00:00Z',
    updatedAt: '2026-07-05T10:00:00Z',
  },
  {
    id: DOCUMENT_IDS[5],
    userId: MOCK_USER_ID,
    type: 'CERTIFICATE',
    title: 'ISO 27001 Certification',
    description: 'ISO 27001 information security management certification.',
    summary:
      'Certification confirms compliance with ISO/IEC 27001:2022 information security management standards. Valid for 3 years subject to annual surveillance audits. Scope covers cloud infrastructure and customer data handling processes.',
    documentNumber: 'ISO27001-2026-0091',
    issuer: { name: 'Global Certification Body', email: 'certs@globalcert.example' },
    parties: [],
    effectiveDate: '2026-05-01T00:00:00Z',
    expiryDate: '2029-05-01T00:00:00Z',
    attachments: [],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-006',
    sourceType: 'EMAIL',
    threadId: 'th-doc-006',
    messageId: 'msg-doc-006',
    metadata: {},
    createdAt: '2026-05-02T09:00:00Z',
    updatedAt: '2026-05-02T09:00:00Z',
  },
  {
    id: DOCUMENT_IDS[6],
    userId: MOCK_USER_ID,
    type: 'LICENSE',
    title: 'Software License Agreement - Analytics Platform',
    description: 'Annual license agreement for the analytics platform used by the data team.',
    summary:
      'Grants a non-exclusive, non-transferable license for up to 50 named users. Renews automatically each year unless cancelled 60 days before expiry. Excludes reverse engineering and resale rights.',
    documentNumber: 'LIC-2026-0091',
    issuer: { name: 'DataViz Analytics Inc', email: 'licensing@dataviz.example' },
    parties: [{ name: 'DataViz Analytics Inc', role: 'LICENSOR' }, { name: 'Acme Corporation', role: 'LICENSEE' }],
    effectiveDate: '2026-01-01T00:00:00Z',
    expiryDate: '2027-01-01T00:00:00Z',
    attachments: [],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-007',
    sourceType: 'EMAIL',
    threadId: 'th-doc-007',
    messageId: 'msg-doc-007',
    metadata: {},
    createdAt: '2026-01-03T13:00:00Z',
    updatedAt: '2026-01-03T13:00:00Z',
  },
  {
    id: DOCUMENT_IDS[7],
    userId: MOCK_USER_ID,
    type: 'AGREEMENT',
    title: 'Vendor Agreement - Zamp',
    description: 'General vendor agreement covering procurement terms with Zamp.',
    summary:
      'Sets net-45 payment terms and a 2% early-payment discount for settlement within 10 days. Includes a most-favored-customer pricing clause. No minimum commitment volume specified.',
    documentNumber: null,
    issuer: { name: 'Zamp', email: 'sales@zamp.com' },
    parties: [
      { name: 'Zamp', role: 'VENDOR' },
      { name: 'Acme Corporation', role: 'CUSTOMER' },
    ],
    effectiveDate: '2026-03-01T00:00:00Z',
    expiryDate: null,
    attachments: [],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-008',
    sourceType: 'EMAIL',
    threadId: 'th-doc-008',
    messageId: 'msg-doc-008',
    metadata: {},
    createdAt: '2026-03-02T15:00:00Z',
    updatedAt: '2026-03-02T15:00:00Z',
  },
  {
    id: DOCUMENT_IDS[8],
    userId: MOCK_USER_ID,
    type: 'POLICY',
    title: 'Remote Work Policy',
    description: 'Internal policy governing remote and hybrid work arrangements.',
    summary:
      'Employees may work remotely up to 3 days per week without manager pre-approval. Equipment stipend of $500/year for home office setup. Core collaboration hours are 10am-3pm local time.',
    documentNumber: null,
    issuer: { name: 'People Operations', email: 'hr@acme.com' },
    parties: [],
    effectiveDate: '2026-02-01T00:00:00Z',
    expiryDate: null,
    attachments: [],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-009',
    sourceType: 'EMAIL',
    threadId: 'th-doc-009',
    messageId: 'msg-doc-009',
    metadata: {},
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-01T09:00:00Z',
  },
  {
    id: DOCUMENT_IDS[9],
    userId: MOCK_USER_ID,
    type: 'OTHER',
    title: 'Product Roadmap Whitepaper - H2 2026',
    description: 'Vendor-shared whitepaper outlining upcoming platform features.',
    summary:
      'Outlines planned features for H2 2026 including a new reporting API and expanded SSO provider support. Positioned as informational, not a contractual commitment. No dates are guaranteed.',
    documentNumber: null,
    issuer: { name: 'CloudPlatform Inc', email: 'product@cloudplatform.example' },
    parties: [],
    effectiveDate: null,
    expiryDate: null,
    attachments: [],
    sourceUrl: 'https://mail.google.com/mail/u/0/#all/doc-msg-010',
    sourceType: 'EMAIL',
    threadId: 'th-doc-010',
    messageId: 'msg-doc-010',
    metadata: {},
    createdAt: '2026-08-10T16:00:00Z',
    updatedAt: '2026-08-10T16:00:00Z',
  },
];
