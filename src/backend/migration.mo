import Map "mo:core/Map";
import Array "mo:core/Array";
import List "mo:core/List";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

module {
  type UserProfile = {
    name : Text;
    role : Text;
  };

  type LabelConfig = {
    width : Nat;
    height : Nat;
    margin : Nat;
    barcodeType : Text;
    customText : Text;
    textSize : Nat;
    font : Text;
    barcodePositionX : Nat;
    barcodePositionY : Nat;
    textPositionX : Nat;
    textPositionY : Nat;
    barcodeHeight : Nat;
    barcodeWidthScale : Nat;
    horizontalSpacing : Nat;
    centerContents : Bool;
  };

  type Printer = {
    name : Text;
    connectionType : Text;
    status : Text;
  };

  type PrintRecord = {
    timestamp : Int;
    serialNumber : Text;
    labelType : Text;
    printer : Text;
  };

  type ErrorLog = {
    timestamp : Int;
    errorMessage : Text;
    printer : ?Text;
  };

  type TitleMapping = {
    prefix : Text;
    title : Text;
  };

  type OldActor = {
    userProfiles : Map.Map<Principal, UserProfile>;
    labelConfigs : Map.Map<Text, LabelConfig>;
    printers : Map.Map<Text, Printer>;
    printHistory : [PrintRecord];
    errorLogs : [ErrorLog];
    labelCounters : Map.Map<Text, Nat>;
    prefixesList : List.List<Text>;
    titleMappingsList : List.List<TitleMapping>;
    v72LabelKey : Text;
  };

  type NewActor = {
    userProfiles : Map.Map<Principal, UserProfile>;
    labelConfigs : Map.Map<Text, LabelConfig>;
    printers : Map.Map<Text, Printer>;
    printHistory : [PrintRecord];
    errorLogs : [ErrorLog];
    labelCounters : Map.Map<Text, Nat>;
    prefixesList : List.List<Text>;
    titleMappingsList : List.List<TitleMapping>;
  };

  /// A migration function that transforms OldActor into NewActor by dropping v72LabelKey
  public func run(old : OldActor) : NewActor {
    {
      userProfiles = old.userProfiles;
      labelConfigs = old.labelConfigs;
      printers = old.printers;
      printHistory = old.printHistory;
      errorLogs = old.errorLogs;
      labelCounters = old.labelCounters;
      prefixesList = old.prefixesList;
      titleMappingsList = old.titleMappingsList;
    };
  };
};
