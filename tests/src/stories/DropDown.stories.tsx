import React, { useEffect, useRef } from 'react';
import { useSlashAuth } from '@slashauth/slashauth-react';
import { userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

export default {
  title: 'DropDown',
};

export const Primary = () => {
  const context = useSlashAuth();
  const { mountDropDown } = context;
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      mountDropDown(ref.current);
    }
  }, [mountDropDown]);
  return <div ref={ref} />;
};
Primary.play = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);

  await canvas.findByTestId('DropDown');

  await userEvent.click(canvas.getByTestId('DropDown'));

  expect(
    canvas.getByText(
      'Everything is perfect. Your account is ready and we should probably get you started!'
    )
  ).toBeInTheDocument();
};
