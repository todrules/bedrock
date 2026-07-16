import { fireEvent, render, screen } from '@testing-library/react';

import { ChatMessage } from '@/components/Chat/ChatMessage';
import type { Message } from '@/types';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    <div>
      {children
        .split(/(\*\*.*?\*\*|`.*?`)/g)
        .filter(Boolean)
        .map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
          }

          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={index}>{part.slice(1, -1)}</code>;
          }

          return <span key={index}>{part}</span>;
        })}
    </div>
  ),
}));

jest.mock('remark-gfm', () => jest.fn());
jest.mock('rehype-highlight', () => jest.fn());

const baseMessage: Message = {
  id: 'message-1',
  conversationId: 'conversation-1',
  role: 'user',
  content: 'Hello from the user',
  createdAt: '2026-07-16T19:55:47.134Z',
};

describe('ChatMessage', () => {
  it('renders a user message', () => {
    render(<ChatMessage message={baseMessage} />);

    expect(screen.getByText('Hello from the user')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders an assistant message with markdown', () => {
    render(
      <ChatMessage
        message={{
          ...baseMessage,
          role: 'assistant',
          content: 'Here is **bold** markdown and a `code` sample.',
        }}
      />,
    );

    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
  });

  it('shows citations when present', () => {
    render(
      <ChatMessage
        message={{
          ...baseMessage,
          role: 'assistant',
          citations: [
            {
              id: 'citation-1',
              title: 'Employee Handbook',
              excerpt: 'The handbook states the approved support workflow.',
              url: 'https://example.com/handbook',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText('Citations'));

    expect(screen.getByText('Employee Handbook')).toBeInTheDocument();
    expect(screen.getByText('The handbook states the approved support workflow.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ChatMessage isLoading />);

    expect(screen.getByTestId('chat-message-loading')).toBeInTheDocument();
  });
});
