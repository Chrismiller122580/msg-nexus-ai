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

type MagicLinkEmailProps = {
  signInUrl: string;
  expiresMinutes?: number;
};

export function MagicLinkEmail({ signInUrl, expiresMinutes = 15 }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Your MsgNexus sign-in link (expires in ${expiresMinutes} minutes)`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Sign in to MsgNexus</Heading>
          <Text style={paragraph}>
            Click the button below to sign in. This link expires in {expiresMinutes} minutes and
            can only be used once.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={signInUrl}>
              Sign in to MsgNexus
            </Button>
          </Section>
          <Text style={paragraph}>
            If you didn&apos;t request this email, you can safely ignore it.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If the button doesn&apos;t work, copy this link into your browser:
            <br />
            {signInUrl}
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

const hr = {
  borderColor: '#e4e4e7',
  margin: '28px 0 16px',
};

const footer = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '20px',
  margin: 0,
  wordBreak: 'break-all' as const,
};