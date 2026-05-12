import React from 'react';
import classNames from 'classnames';

export function Card({ className, children }) {
  return (
    <div
      className={classNames(
        'rounded-2xl bg-[#1e1e2f] text-white shadow-md p-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardContent({ children }) {
  return <div className="p-2">{children}</div>;
}
