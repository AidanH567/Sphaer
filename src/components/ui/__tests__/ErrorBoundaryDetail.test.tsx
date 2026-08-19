/**
 * The error fallback must name the fault, in production as well as dev.
 *
 * `{__DEV__ && <Text>{error.message}</Text>}` cost a day on report 3dfb4ca8:
 * Aidan saw "Something went wrong" on the production web build, could only
 * report the symptom, and three people then investigated the wrong component.
 * The message is the entire diagnostic value of an error screen for an app
 * whose userbase is three testers who all file reports.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { makeRouteErrorBoundary } from '../ErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('useAppContext must be used inside AppProvider');
}

describe('the route error fallback', () => {
  it('shows the real error message, not just "Something went wrong"', () => {
    const Boundary = makeRouteErrorBoundary('notifications');
    const { getByText } = render(
      <Boundary error={new Error('useAppContext must be used inside AppProvider')} retry={() => {}} />
    );
    getByText('Something went wrong');
    // The line that identifies the fault. Without it a report can only say
    // "it breaks", which is what happened.
    getByText('useAppContext must be used inside AppProvider');
  });

  it('says so plainly when the error carries no message', () => {
    const Boundary = makeRouteErrorBoundary('notifications');
    const { getByText } = render(<Boundary error={new Error('')} retry={() => {}} />);
    getByText('No error message was provided.');
  });

  it('is not gated on __DEV__', () => {
    // The regression this guards: re-adding the condition would restore a
    // fallback that is useful to developers and useless to the people who
    // actually hit it.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'ErrorBoundary.tsx'), 'utf8');
    expect(src).not.toMatch(/__DEV__\s*&&\s*\(?\s*<Text style=\{styles\.errorDetail\}/);
  });
});
