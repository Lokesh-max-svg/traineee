'use client';

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { restoreAuthSession } from './store/authSlice';
import { useAppDispatch } from './store/hooks';

function AuthBootstrap({ children }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(restoreAuthSession());
  }, [dispatch]);

  return children;
}

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </Provider>
  );
}
