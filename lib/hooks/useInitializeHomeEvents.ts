// App.tsx or your initialization file
import React, { useEffect } from 'react';

import { useHomeEventsStore } from '../../store/homeEventsStore';

export function useInitializeHomeEvents() {
    const incrementAppLaunch = useHomeEventsStore(
        (state) => state.incrementAppLaunch,
    );

    useEffect(() => {
        incrementAppLaunch();

    }, [incrementAppLaunch]);
}
