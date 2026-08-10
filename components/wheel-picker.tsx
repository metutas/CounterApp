import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export const ITEM_HEIGHT = 44;
export const VISIBLE_ITEMS = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
export const PICKER_PADDING = (ITEM_HEIGHT * (VISIBLE_ITEMS - 1)) / 2;

// Ayrı bir bileşene alınıp memo ile sarmalanarak her scroll tick'inde
// sadece seçili durumu değişen satırların yeniden render olması sağlanır.
const PickerItem = memo(function PickerItem({
  value,
  index,
  isSelected,
  isDark,
  onPress,
}: {
  value: number;
  index: number;
  isSelected: boolean;
  isDark: boolean;
  onPress: (value: number, index: number) => void;
}) {
  return (
    <Pressable style={styles.pickerItem} onPress={() => onPress(value, index)}>
      <Text
        style={[
          styles.pickerItemText,
          {
            color: isSelected ? (isDark ? '#ffffff' : '#000000') : '#8e8e93',
            fontWeight: isSelected ? '700' : '500',
            fontSize: isSelected ? 30 : 24,
          },
        ]}
      >
        {value.toString().padStart(2, '0')}
      </Text>
    </Pressable>
  );
});

export const WheelPicker = memo(function WheelPicker({
  values,
  selected,
  onChange,
  isDark,
}: {
  values: number[];
  selected: number;
  onChange: (value: number) => void;
  isDark: boolean;
}) {
  const listRef = useRef<FlatList<number>>(null);
  const inputRef = useRef<TextInput>(null);
  const isLaidOut = useRef(false);
  const [localSelected, setLocalSelected] = useState(selected);
  const localSelectedRef = useRef(localSelected);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  // Her scroll tick'inde tüm satırların yeniden render olmasını önlemek için
  // (bkz. handleItemPress) güncel seçim ref üzerinden okunuyor.
  useEffect(() => {
    localSelectedRef.current = localSelected;
  }, [localSelected]);

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    listRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated });
  }, []);

  // Dışarıdan selected değişirse tekerleği o konuma taşı.
  useEffect(() => {
    setLocalSelected(selected);
    if (isLaidOut.current) {
      scrollToIndex(selected, false);
    }
  }, [selected]);

  const handleLayout = () => {
    isLaidOut.current = true;
    scrollToIndex(selected, false);
    setTimeout(() => scrollToIndex(selected, false), 0);
  };

  // Kaydırma sırasında yerel vurguyu güncelle
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(y / ITEM_HEIGHT)));
    if (index !== localSelected) {
      setLocalSelected(index);
    }
  };

  // Kaydırma bittiğinde ebeveyne bildir
  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    setLocalSelected(clamped);
    scrollToIndex(clamped, true);
    onChange(values[clamped]);
  };

  // Kararlı (stable) referans: localSelected'ı state yerine ref'ten okur,
  // böylece PickerItem'lara geçilen onPress prop'u her scroll'da değişmez
  // ve memo() satırları gereksiz yere yeniden render etmez.
  const handleItemPress = useCallback(
    (val: number, index: number) => {
      if (index === localSelectedRef.current) {
        // Ortadaki seçili elemana dokunulursa doğrudan klavye ile yazma modunu aç
        setText(val.toString());
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        // Başka bir sayıya dokunulursa o sayıya kaydır ve seç
        setLocalSelected(index);
        scrollToIndex(index, true);
        onChange(val);
      }
    },
    [onChange, scrollToIndex]
  );

  const maxDigits = String(values.length - 1).length;

  const handleChangeText = (t: string) => {
    const cleaned = t.replace(/[^0-9]/g, '').slice(0, maxDigits);
    setText(cleaned);
    const parsed = parseInt(cleaned, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= values.length - 1) {
      setLocalSelected(parsed);
      onChange(parsed);
      scrollToIndex(parsed, false);
    }
  };

  const commitEditing = () => {
    setEditing(false);
    const parsed = parseInt(text, 10);
    const clamped = Number.isNaN(parsed) ? selected : Math.max(0, Math.min(values.length - 1, parsed));
    setLocalSelected(clamped);
    scrollToIndex(clamped, true);
    onChange(clamped);
  };

  return (
    <View style={styles.pickerColumn}>
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(v) => v.toString()}
        renderItem={({ item: v, index }: ListRenderItemInfo<number>) => (
          <PickerItem
            value={v}
            index={index}
            isSelected={v === localSelected}
            isDark={isDark}
            onPress={handleItemPress}
          />
        )}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        extraData={localSelected}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PICKER_PADDING }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        onLayout={handleLayout}
        nestedScrollEnabled={true}
        scrollEnabled={!editing}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={7}
        removeClippedSubviews
      />

      {/* Ortadaki altın çizgi vurgusu - pointerEvents="none" ile kaydırmayı KESİNLİKLE engellemez */}
      <View pointerEvents="none" style={styles.pickerHighlight} />

      {/* Üst/alt kenarları saydamlaştırarak akışı yumuşatan degrade */}
      <LinearGradient
        pointerEvents="none"
        colors={isDark ? ['#000000', 'transparent'] : ['#ffffff', 'transparent']}
        style={styles.fadeTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={isDark ? ['transparent', '#000000'] : ['transparent', '#ffffff']}
        style={styles.fadeBottom}
      />

      {editing && (
        <TextInput
          ref={inputRef}
          style={[
            styles.pickerHighlightInput,
            styles.pickerInput,
            { color: isDark ? '#ffffff' : '#000000', backgroundColor: isDark ? '#000000' : '#ffffff' },
          ]}
          value={text}
          onChangeText={handleChangeText}
          onSubmitEditing={commitEditing}
          onBlur={commitEditing}
          keyboardType="numeric"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={maxDigits}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  pickerColumn: {
    height: PICKER_HEIGHT,
    width: 76,
  },

  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PICKER_PADDING,
  },

  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PICKER_PADDING,
  },

  pickerItemText: {
    fontSize: 26,
    fontWeight: '600',
  },

  pickerHighlight: {
    position: 'absolute',
    top: PICKER_PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFC107',
  },

  pickerHighlightInput: {
    position: 'absolute',
    top: PICKER_PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFC107',
  },

  pickerInput: {
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 28,
    fontWeight: '700',
    paddingVertical: 0,
    includeFontPadding: false,
  },
});
