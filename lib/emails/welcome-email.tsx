import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

type WelcomeEmailProps = {
  name?: string | null;
  appUrl: string;
};

export function WelcomeEmail({ name, appUrl }: WelcomeEmailProps) {
  const greeting = name?.trim() ? `Hi ${name},` : 'Hi there,';

  return (
    <Html>
      <Head />
      <Preview>Your unified inbox is ready — connect platforms and start searching.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome to MsgNexus</Heading>
          <Text style={paragraph}>{greeting}</Text>
          <Text style={paragraph}>
            You now have one place for all your messages — with semantic search and AI that
            spots bills, subscriptions, and shopping automatically.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={`${appUrl}/onboarding`}>
              Connect your platforms
            </Button>
          </Section>
          <Text style={paragraph}>
            Or jump straight to your inbox and explore with demo data.
          </Text>
          <Button style={buttonSecondary} href={`${appUrl}/inbox`}>
            Open inbox
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            MsgNexus.AI — unify messaging, search anywhere, let AI do the sorting.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#fafafa',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '32px 24px',
  maxWidth: '520px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
};

const heading = {
  color: '#18181b',
  fontSize: '24px',
  fontWeight: '600',
  margin: '0 0 20px',
};

const paragraph = {
  color: '#52525b',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const buttonSection = {
  margin: '24px 0',
};

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 20px',
};

const buttonSecondary = {
  ...button,
  backgroundColor: '#f4f4f5',
  color: '#18181b',
  marginTop: '8px',
};

const hr = {
  borderColor: '#e4e4e7',
  margin: '28px 0 16px',
};

const footer = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '20px',
  margin: 0,
};